import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

@Injectable()
export class ReceiptService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generates a PDF receipt for a given payment record.
   * Returns the PDF as a Buffer.
   */
  async generateReceipt(paymentId: string): Promise<Buffer> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: { select: { name: true, phone: true, email: true } },
        invoice: { include: { batch: { select: { name: true } } } },
      },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Header ──────────────────────────────────────────────
      doc
        .fontSize(22)
        .fillColor('#1d4ed8')
        .text('Kheloge', { align: 'center' })
        .moveDown(0.2);

      doc
        .fontSize(10)
        .fillColor('#6b7280')
        .text('Sports Management Platform', { align: 'center' })
        .moveDown(1);

      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor('#e5e7eb')
        .stroke()
        .moveDown(0.5);

      // ── Receipt title ────────────────────────────────────────
      doc
        .fontSize(16)
        .fillColor('#111827')
        .text('Payment Receipt', { align: 'center' })
        .moveDown(0.3);

      doc
        .fontSize(10)
        .fillColor('#6b7280')
        .text(`Receipt No: ${payment.receiptNumber}`, { align: 'center' })
        .moveDown(1);

      // ── Student details ──────────────────────────────────────
      this.sectionHeader(doc, 'Student Details');
      this.row(doc, 'Name', payment.student.name);
      this.row(doc, 'Phone', payment.student.phone ?? '—');
      if (payment.student.email) this.row(doc, 'Email', payment.student.email);
      doc.moveDown(0.5);

      // ── Payment details ──────────────────────────────────────
      this.sectionHeader(doc, 'Payment Details');
      this.row(doc, 'Amount', `₹${Number(payment.amount).toLocaleString('en-IN')}`);
      this.row(doc, 'Mode', payment.mode);
      this.row(doc, 'Status', payment.status);
      if (payment.referenceNumber) this.row(doc, 'Reference', payment.referenceNumber);
      if (payment.paidAt) this.row(doc, 'Paid On', new Date(payment.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
      if (payment.invoice?.batch) this.row(doc, 'Batch', payment.invoice.batch.name);
      if (payment.notes) this.row(doc, 'Notes', payment.notes);
      doc.moveDown(1);

      // ── Footer ───────────────────────────────────────────────
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor('#e5e7eb')
        .stroke()
        .moveDown(0.5);

      doc
        .fontSize(9)
        .fillColor('#9ca3af')
        .text('This is a computer-generated receipt and does not require a signature.', { align: 'center' });

      doc.end();
    });
  }

  private sectionHeader(doc: PDFKit.PDFDocument, title: string) {
    doc
      .fontSize(11)
      .fillColor('#374151')
      .font('Helvetica-Bold')
      .text(title)
      .font('Helvetica')
      .moveDown(0.3);
  }

  private row(doc: PDFKit.PDFDocument, label: string, value: string) {
    const y = doc.y;
    doc
      .fontSize(10)
      .fillColor('#6b7280')
      .text(label, 50, y, { width: 150 })
      .fillColor('#111827')
      .text(value, 210, y)
      .moveDown(0.3);
  }
}
