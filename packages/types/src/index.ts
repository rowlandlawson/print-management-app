export interface User {
  id: string;
  email: string;
  name: string;
  userName?: string;
  role: 'admin' | 'worker';
  isActive: boolean;
  
  // Worker payment information
  hourlyRate?: number;
  monthlySalary?: number;
  paymentMethod?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  
  // Personal information
  phone?: string;
  address?: string;
  dateJoined?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalJobsCount: number;
  totalAmountSpent: number;
  firstInteractionDate: Date;
  lastInteractionDate: Date;
  createdAt: Date;
}

export interface Job {
  id: string;
  ticketId: string;
  customerId: string;
  workerId: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'delivered';
  totalCost: number;
  amountPaid: number;
  balance: number;
  paymentStatus: 'pending' | 'partially_paid' | 'fully_paid';
  modeOfPayment?: 'cash' | 'transfer' | 'pos';
  
  // Profit calculation
  materialsCost: number;
  wasteCost: number;
  operationalCost: number;
  laborCost: number;
  profit: number;
  
  dateRequested: Date;
  deliveryDeadline?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  jobId: string;
  amount: number;
  paymentType: 'deposit' | 'installment' | 'full_payment' | 'balance';
  date: Date;
  recordedBy: string;
  recordedById: string;
  paymentMethod: 'cash' | 'transfer' | 'pos';
  receiptNumber: string;
  notes?: string;
}

export interface MaterialUsed {
  id: string;
  jobId: string;
  materialId?: string;
  materialName: string;
  paperSize?: string;
  paperType?: string;
  grammage?: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  createdAt: Date;
}

export interface Inventory {
  id: string;
  materialName: string;
  category: string;
  paperSize?: string;
  paperType?: string;
  grammage?: number;
  supplier?: string;
  currentStock: number;
  unitOfMeasure: string;
  unitCost: number;
  sellingPrice?: number;
  threshold: number;
  reorderQuantity?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WasteExpense {
  id: string;
  jobId?: string;
  type: 'paper_waste' | 'material_waste' | 'labor' | 'operational' | 'other';
  description: string;
  quantity?: number;
  unitCost?: number;
  totalCost: number;
  wasteReason?: string;
  createdAt: Date;
}

export interface OperationalExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  expenseDate: Date;
  recordedBy?: string;
  receiptNumber?: string;
  notes?: string;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'new_job' | 'payment_update' | 'status_change' | 'low_stock' | 'system' | 'alert';
  relatedEntityType?: 'job' | 'payment' | 'inventory' | 'customer' | 'user';
  relatedEntityId?: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string;
  imageUrl?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    name: string;
  };
}

// Request DTOs
export interface CreateUserDTO {
  email: string;
  name: string;
  userName?: string;
  phone?: string;
  address?: string;
  dateJoined?: string;
  hourlyRate?: number;
  monthlySalary?: number;
  paymentMethod?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface UpdateUserDTO extends Partial<CreateUserDTO> {
  isActive?: boolean;
}

export interface CreateJobDTO {
  customerId: string;
  description: string;
  totalCost: number;
  dateRequested: string;
  deliveryDeadline?: string;
  modeOfPayment?: 'cash' | 'transfer' | 'pos';
}

export interface RecordPaymentDTO {
  jobId: string;
  amount: number;
  paymentType: 'deposit' | 'installment' | 'full_payment' | 'balance';
  paymentMethod: 'cash' | 'transfer' | 'pos';
  notes?: string;
}