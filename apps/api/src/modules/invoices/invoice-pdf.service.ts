import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentStatus } from '@kheloge/database';
import { v4 as uuidv4 } from 'uuid';
import { FileUploadService } from '../uploads/file-upload.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

@Injectable()
export class InvoicePdfService {
  constructor(
    private prisma: PrismaService,
    private fileUpload: FileUploadService,
  ) {}

  /**
   * Generates a full Invoice PDF with fee breakdown and payment status.
   * Returns the PDF as a Buffer.
   */
  async generateInvoicePdf(invoiceId: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        student: {
          include: { organization: true },
        },
        batch: { include: { venue: true } },
        payments: {
          where: { status: PaymentStatus.PAID },
          orderBy: { paidAt: 'desc' },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    const org = invoice.student.organization;
    const venue = invoice.batch?.venue ?? null;

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const brand = venue?.primaryColor ?? '#1d4ed8';

      // ── Header ──────────────────────────────────────────────
      doc
        .fontSize(24)
        .fillColor(brand)
        .font('Helvetica-Bold')
        .text(org?.name ?? 'Kheloge', { align: 'center' })
        .font('Helvetica')
        .moveDown(0.2);

      if (org?.address) {
        doc
          .fontSize(9)
          .fillColor('#6b7280')
          .text(org.address, { align: 'center' });
      }

      const contactParts: string[] = [];
      if (org?.phone) contactParts.push(org.phone);
      if (org?.email) contactParts.push(org.email);
      if (contactParts.length) {
        doc
          .fontSize(9)
          .fillColor('#6b7280')
          .text(contactParts.join('  ·  '), { align: 'center' });
      }

      doc.moveDown(0.6);
      this.divider(doc);
      doc.moveDown(0.6);

      // ── Invoice title & badge ────────────────────────────────
      const statusColor = this.statusColor(invoice.status);
      doc
        .fontSize(18)
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .text('INVOICE', 50, doc.y, { continued: true })
        .fontSize(11)
        .fillColor(statusColor)
        .text(`  [${invoice.status}]`, { align: 'left' })
        .font('Helvetica')
        .moveDown(0.3);

      doc
        .fontSize(10)
        .fillColor('#6b7280')
        .text(`Invoice No: ${invoice.invoiceNumber}`)
        .moveDown(0.6);

      // ── Two-column meta block ────────────────────────────────
      const colLeft = 50;
      const colRight = 310;
      let rowY = doc.y;

      doc.fontSize(10);

      // Left column: student info
      doc
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .text('Bill To:', colLeft, rowY)
        .font('Helvetica')
        .fillColor('#111827')
        .text(invoice.student.name, colLeft, doc.y)
        .fillColor('#6b7280')
        .text(invoice.student.phone ?? '', colLeft)
        .text(invoice.student.email ?? '', colLeft);

      // Right column: dates
      const dateY = rowY;
      const fmtDate = (d: Date) =>
        d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      doc
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .text('Issued:', colRight, dateY, { width: 80, continued: true })
        .font('Helvetica')
        .fillColor('#111827')
        .text(`  ${fmtDate(invoice.createdAt)}`, { width: 160 });

      doc
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .text('Due:', colRight, doc.y, { width: 80, continued: true })
        .font('Helvetica')
        .fillColor('#111827')
        .text(`  ${fmtDate(invoice.dueDate)}`, { width: 160 });

      doc.moveDown(1.5);

      // ── Fee breakdown table ──────────────────────────────────
      this.sectionHeader(doc, 'Fee Breakdown');

      // Table header row
      const tableTop = doc.y;
      const colDesc = 50;
      const colFreq = 260;
      const colAmt = 400;
      const colTotal = 480;

      doc
        .fontSize(9)
        .fillColor('#ffffff')
        .rect(colDesc, tableTop, 495, 18)
        .fill(brand);

      doc
        .fillColor('#ffffff')
        .text('Description', colDesc + 4, tableTop + 4, { width: 200 })
        .text('Frequency', colFreq, tableTop + 4, { width: 120 })
        .text('Amount', colAmt, tableTop + 4, { width: 70, align: 'right' });

      let tableY = tableTop + 22;

      // Fee plan row
      const fmtRupee = (n: number | string | { toNumber(): number } | null | undefined) => {
        const val = n == null ? 0 : typeof n === 'object' ? n.toNumber() : Number(n);
        return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      };

      this.tableRow(doc, tableY, colDesc, colFreq, colAmt, invoice.batch?.name ?? 'Monthly Fee', 'Monthly', fmtRupee(invoice.amount));
      tableY += 22;

      // Total row
      doc
        .moveTo(colDesc, tableY)
        .lineTo(colDesc + 495, tableY)
        .strokeColor('#e5e7eb')
        .stroke();

      tableY += 6;

      doc
        .fontSize(11)
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .text('Total Due', colDesc + 4, tableY, { width: 380 })
        .fillColor(brand)
        .text(fmtRupee(invoice.amount), colAmt, tableY, { width: 70, align: 'right' })
        .font('Helvetica');

      doc.y = tableY + 24;
      doc.moveDown(0.5);

      // ── Payment history ──────────────────────────────────────
      if (invoice.payments.length > 0) {
        this.sectionHeader(doc, 'Payment History');

        for (const pmt of invoice.payments) {
          const y = doc.y;
          doc
            .fontSize(10)
            .fillColor('#6b7280')
            .text(`${pmt.receiptNumber} — ${pmt.mode}`, colDesc, y, { width: 300 })
            .fillColor('#16a34a')
            .font('Helvetica-Bold')
            .text(fmtRupee(pmt.amount), colAmt, y, { width: 70, align: 'right' })
            .font('Helvetica');

          if (pmt.paidAt) {
            doc
              .fontSize(9)
              .fillColor('#9ca3af')
              .text(fmtDate(pmt.paidAt), colDesc, doc.y);
          }
          doc.moveDown(0.3);
        }

        const totalPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
        const balance = Number(invoice.amount) - totalPaid;

        doc.moveDown(0.3);
        this.divider(doc);
        doc.moveDown(0.3);

        const balY = doc.y;
        doc
          .fontSize(11)
          .fillColor('#374151')
          .font('Helvetica-Bold')
          .text('Total Paid', colDesc, balY, { width: 380 })
          .fillColor('#16a34a')
          .text(fmtRupee(totalPaid), colAmt, balY, { width: 70, align: 'right' })
          .font('Helvetica');

        doc.moveDown(0.5);

        const remY = doc.y;
        doc
          .fontSize(11)
          .fillColor('#374151')
          .font('Helvetica-Bold')
          .text('Balance', colDesc, remY, { width: 380 })
          .fillColor(balance <= 0 ? '#16a34a' : '#dc2626')
          .text(fmtRupee(balance), colAmt, remY, { width: 70, align: 'right' })
          .font('Helvetica');

        doc.moveDown(1);
      }

      // ── Footer ───────────────────────────────────────────────
      this.divider(doc);
      doc.moveDown(0.5);

      doc
        .fontSize(9)
        .fillColor('#9ca3af')
        .text('This is a computer-generated invoice.', { align: 'center' });

      if (venue?.name) {
        doc.text(`Issued by ${venue.name}`, { align: 'center' });
      }

      doc.end();
    });
  }

  private statusColor(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.PAID: return '#16a34a';
      case PaymentStatus.OVERDUE: return '#dc2626';
      case PaymentStatus.PENDING: return '#d97706';
      default: return '#6b7280';
    }
  }

  private divider(doc: PDFKit.PDFDocument) {
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#e5e7eb')
      .stroke();
  }

  private sectionHeader(doc: PDFKit.PDFDocument, title: string) {
    doc
      .fontSize(11)
      .fillColor('#374151')
      .font('Helvetica-Bold')
      .text(title)
      .font('Helvetica')
      .moveDown(0.4);
  }

  private tableRow(
    doc: PDFKit.PDFDocument,
    y: number,
    colDesc: number,
    colFreq: number,
    colAmt: number,
    desc: string,
    freq: string,
    amount: string,
    amountColor = '#111827',
  ) {
    doc
      .moveTo(colDesc, y + 20)
      .lineTo(colDesc + 495, y + 20)
      .strokeColor('#f3f4f6')
      .stroke();

    doc
      .fontSize(10)
      .fillColor('#374151')
      .text(desc, colDesc + 4, y + 4, { width: 200 })
      .fillColor('#6b7280')
      .text(freq, colFreq, y + 4, { width: 120 })
      .fillColor(amountColor)
      .text(amount, colAmt, y + 4, { width: 70, align: 'right' });
  }

  /**
   * Generates an invoice PDF, uploads it to R2 (invoices/ folder),
   * stores the public URL on the invoice record, and returns the URL.
   */
  async generateAndUploadInvoicePdf(invoiceId: string): Promise<string> {
    const pdf = await this.generateInvoicePdf(invoiceId);
    const fileName = `${invoiceId}-${uuidv4()}.pdf`;
    const url = await this.fileUpload.upload('invoices', fileName, pdf, 'application/pdf');
    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { pdfUrl: url } });
    return url;
  }
}
