import '@fastify/multipart';
import { FastifyRequest } from 'fastify';

/**
 * FastifyRequest augmented with @fastify/multipart methods.
 * Importing @fastify/multipart triggers its module augmentation of FastifyRequest.
 */
export type MultipartRequest = FastifyRequest;
