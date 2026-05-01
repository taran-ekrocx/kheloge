import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/attendance',
})
export class AttendanceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('AttendanceGateway');

  handleConnection(client: Socket) {
    this.logger.log(`WS client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinBatch')
  handleJoinBatch(@MessageBody() batchId: string, @ConnectedSocket() client: Socket) {
    client.join(`batch:${batchId}`);
    this.logger.log(`Client ${client.id} joined batch room: ${batchId}`);
    return { event: 'joined', batchId };
  }

  @SubscribeMessage('leaveBatch')
  handleLeaveBatch(@MessageBody() batchId: string, @ConnectedSocket() client: Socket) {
    client.leave(`batch:${batchId}`);
    return { event: 'left', batchId };
  }

  /**
   * Called by AttendanceService after marking attendance to push real-time updates.
   */
  emitAttendanceUpdate(batchId: string, payload: { date: string; records: any[] }) {
    this.server.to(`batch:${batchId}`).emit('attendanceUpdate', payload);
  }

  /**
   * Called after a QR check-in so live dashboards refresh immediately.
   */
  emitQrCheckin(batchId: string, payload: { studentId: string; status: string; checkInAt: string }) {
    this.server.to(`batch:${batchId}`).emit('qrCheckin', payload);
  }
}
