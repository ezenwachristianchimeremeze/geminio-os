/**
 * Geminio OS - Permission Gates & Approval Workflows
 * 
 * Handles:
 * - Permission checks
 * - Approval workflows
 * - Sensitive operation gates
 * - Audit trails
 */

interface Permission {
  resource: string;
  action: string;
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
}

interface ApprovalRequest {
  id: string;
  userId: string;
  operation: string;
  details: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  reason?: string;
}

const PERMISSIONS: Record<string, Permission> = {
  // Job operations
  "job:apply": {
    resource: "job",
    action: "apply",
    requiresApproval: false,
    riskLevel: "low",
  },
  "job:track": {
    resource: "job",
    action: "track",
    requiresApproval: false,
    riskLevel: "low",
  },

  // Financial operations
  "finance:transaction": {
    resource: "finance",
    action: "transaction",
    requiresApproval: true,
    riskLevel: "high",
  },
  "finance:budget": {
    resource: "finance",
    action: "budget",
    requiresApproval: false,
    riskLevel: "medium",
  },

  // Automation operations
  "automation:create": {
    resource: "automation",
    action: "create",
    requiresApproval: true,
    riskLevel: "high",
  },
  "automation:execute": {
    resource: "automation",
    action: "execute",
    requiresApproval: true,
    riskLevel: "high",
  },

  // Device operations
  "device:control": {
    resource: "device",
    action: "control",
    requiresApproval: true,
    riskLevel: "high",
  },

  // Data operations
  "data:export": {
    resource: "data",
    action: "export",
    requiresApproval: false,
    riskLevel: "medium",
  },
  "data:delete": {
    resource: "data",
    action: "delete",
    requiresApproval: true,
    riskLevel: "high",
  },
};

const approvalRequests: Map<string, ApprovalRequest> = new Map();

/**
 * Check if user has permission for operation
 */
export function checkPermission(userId: string, permissionKey: string): boolean {
  const permission = PERMISSIONS[permissionKey];
  if (!permission) {
    console.warn(`Unknown permission: ${permissionKey}`);
    return false;
  }

  // For now, all authenticated users have permissions
  // Extend this to check user roles and permissions in database
  return true;
}

/**
 * Check if operation requires approval
 */
export function requiresApproval(permissionKey: string): boolean {
  const permission = PERMISSIONS[permissionKey];
  return permission?.requiresApproval ?? false;
}

/**
 * Get risk level for operation
 */
export function getRiskLevel(permissionKey: string): string {
  const permission = PERMISSIONS[permissionKey];
  return permission?.riskLevel ?? "low";
}

/**
 * Create approval request for sensitive operation
 */
export async function createApprovalRequest(
  userId: string,
  operation: string,
  details: Record<string, unknown>
): Promise<ApprovalRequest> {
  const request: ApprovalRequest = {
    id: `approval-${Date.now()}-${Math.random()}`,
    userId,
    operation,
    details,
    status: "pending",
    createdAt: new Date(),
  };

  approvalRequests.set(request.id, request);

  // In production, send notification to admin/approver
  console.log(`Approval request created: ${request.id}`);

  return request;
}

/**
 * Get pending approval requests
 */
export function getPendingApprovals(userId?: string): ApprovalRequest[] {
  const requests = Array.from(approvalRequests.values());
  return requests.filter((r) => {
    if (userId && r.userId !== userId) return false;
    return r.status === "pending";
  });
}

/**
 * Approve request
 */
export async function approveRequest(
  requestId: string,
  approvedBy: string
): Promise<ApprovalRequest | null> {
  const request = approvalRequests.get(requestId);
  if (!request) return null;

  request.status = "approved";
  request.approvedAt = new Date();
  request.approvedBy = approvedBy;

  console.log(`Approval request approved: ${requestId}`);
  return request;
}

/**
 * Reject request
 */
export async function rejectRequest(
  requestId: string,
  reason: string
): Promise<ApprovalRequest | null> {
  const request = approvalRequests.get(requestId);
  if (!request) return null;

  request.status = "rejected";
  request.reason = reason;

  console.log(`Approval request rejected: ${requestId}`);
  return request;
}

/**
 * Check if approval is granted
 */
export async function isApprovalGranted(requestId: string): Promise<boolean> {
  const request = approvalRequests.get(requestId);
  return request?.status === "approved";
}

/**
 * Middleware for permission checking
 */
export async function permissionGate(
  userId: string,
  permissionKey: string,
  operationDetails?: Record<string, unknown>
): Promise<{ allowed: boolean; requestId?: string; reason?: string }> {
  // Check basic permission
  if (!checkPermission(userId, permissionKey)) {
    return {
      allowed: false,
      reason: "User does not have permission for this operation",
    };
  }

  // Check if approval is required
  if (requiresApproval(permissionKey)) {
    const request = await createApprovalRequest(
      userId,
      permissionKey,
      operationDetails || {}
    );
    return {
      allowed: false,
      requestId: request.id,
      reason: "Approval required for this sensitive operation",
    };
  }

  return { allowed: true };
}

/**
 * Audit log for operations
 */
export interface AuditLog {
  id: string;
  userId: string;
  operation: string;
  resource: string;
  action: string;
  result: "success" | "failure" | "pending";
  timestamp: Date;
  details?: Record<string, unknown>;
}

const auditLogs: AuditLog[] = [];

export function logAudit(
  userId: string,
  operation: string,
  resource: string,
  action: string,
  result: "success" | "failure" | "pending",
  details?: Record<string, unknown>
): AuditLog {
  const log: AuditLog = {
    id: `audit-${Date.now()}-${Math.random()}`,
    userId,
    operation,
    resource,
    action,
    result,
    timestamp: new Date(),
    details,
  };

  auditLogs.push(log);

  // Keep only last 10000 logs in memory
  if (auditLogs.length > 10000) {
    auditLogs.shift();
  }

  return log;
}

/**
 * Get audit logs
 */
export function getAuditLogs(
  userId?: string,
  limit: number = 100
): AuditLog[] {
  let logs = auditLogs;
  if (userId) {
    logs = logs.filter((l) => l.userId === userId);
  }
  return logs.slice(-limit);
}

/**
 * Export all permissions
 */
export function getAllPermissions(): Record<string, Permission> {
  return { ...PERMISSIONS };
}
