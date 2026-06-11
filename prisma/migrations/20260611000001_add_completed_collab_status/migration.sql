-- Add COMPLETED status to CollaborationStatus enum
ALTER TYPE "CollaborationStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
