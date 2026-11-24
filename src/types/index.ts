export type Role = 'super_admin' | 'dept_head' | 'staff' | 'procurement';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  position: string | null;
  department_id: string | null;
  department_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  head_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectStatus = 'pending' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  department_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  assigned_to: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  due_date: string;
  achieved_at: string | null;
  created_by: string;
  created_at: string;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  sign_in_at: string | null;
  sign_out_at: string | null;
  sign_in_lat: number | null;
  sign_in_lng: number | null;
  date: string;
  auto_closed: boolean;
  device_id: string | null;
  created_at: string;
}

export interface Overtime {
  id: string;
  user_id: string;
  user_name: string;
  project_id: string | null;
  start_time: string;
  end_time: string | null;
  hours: number | null;
  hourly_rate: number;
  total_amount: number | null;
  is_paid: boolean;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type RoomType = 'general' | 'departmental' | 'project' | 'direct';

export interface ChatRoom {
  id: string;
  name: string;
  type: RoomType;
  department_id: string | null;
  project_id: string | null;
  created_by: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name?: string;
  content: string;
  reply_to_id: string | null;
  is_deleted: boolean;
  created_at: string;
}

export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Acknowledgement {
  user_id: string;
  user_name: string;
  acknowledged_at: string;
}

export interface Memo {
  id: string;
  title: string;
  content: string;
  sender_id: string;
  recipient_id: string | null;
  department_id: string | null;
  read_at: string | null;
  created_at: string;
  acknowledged_at?: string | null;
  acknowledged_count: number;
  pending_count: number;
  acknowledgements?: Acknowledgement[];
}

export type QueryStatus = 'pending' | 'acknowledged' | 'resolved';

export interface Query {
  id: string;
  title: string;
  content: string;
  issuer_id: string;
  recipient_id: string;
  status: QueryStatus;
  response: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LeaveType = 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  user_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalance {
  user_id: string;
  type: LeaveType;
  year: number;
  total: number;
  used: number;
}

export interface Review {
  id: string;
  user_id: string;
  reviewer_id: string;
  period: string;
  rating: number;
  goals: string;
  comments: string;
  created_at: string;
  updated_at: string;
}

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface Claim {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  date: string;
  description: string;
  receipt_url: string | null;
  status: ClaimStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AssetStatus = 'available' | 'assigned' | 'maintenance' | 'retired';

export interface Asset {
  id: string;
  name: string;
  category: string;
  serial_number: string | null;
  description: string | null;
  status: AssetStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationType =
  | 'chat_message'
  | 'project_assigned'
  | 'project_unassigned'
  | 'project_progress'
  | 'project_status'
  | 'overtime_created'
  | 'overtime_paid'
  | 'memo_received'
  | 'query_issued'
  | 'query_responded'
  | 'attendance_sign_in'
  | 'attendance_sign_out'
  | 'attendance_auto_closed'
  | 'leave_approved'
  | 'leave_rejected'
  | 'claim_approved'
  | 'claim_rejected'
  | 'claim_paid'
  | 'asset_assigned'
  | 'task_assigned'
  | 'task_updated'
  | 'project_comment'
  | 'budget_updated'
  | 'project_created'
  | 'project_due_reminder'
  | 'task_due_reminder'
  | 'sign_out_reminder';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  ref_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DashboardStats {
  // Admin
  total_users?: number;
  total_projects?: number;
  active_projects?: number;
  completed_projects?: number;
  pending_leaves?: number;
  pending_claims?: number;
  total_departments?: number;
  signed_in_today?: number;
  total_assets?: number;
  assigned_assets?: number;
  // Dept head
  dept_members?: number;
  dept_active_projects?: number;
  dept_signed_in_today?: number;
  dept_pending_leaves?: number;
  // Staff
  my_projects?: number;
  my_pending_tasks?: number;
  my_pending_leaves?: number;
  my_pending_claims?: number;
  // Charts
  projects_by_status?: Array<{ name: string; value: number }>;
  weekly_attendance?: Array<{ day: string; count: number }>;
  monthly_attendance?: Array<{ day: string; count: number }>;
  personal_weekly_attendance?: Array<{ day: string; count: number }>;
  today_attendees?: Array<{
    name: string;
    position: string;
    department: string;
    sign_in_at: string;
    signed_out: boolean;
  }>;
  project_progress?: Array<{ title: string; progress: number; status: string }>;
}

export interface ProjectExpense {
  id: string;
  project_id: string;
  description: string;
  amount: number;
  date: string;
  logged_by: string;
  created_at: string;
}

export interface BudgetSummary {
  budget: number | null;
  spent: number;
  expenses: ProjectExpense[];
}

export interface ProjectFile {
  id: string;
  project_id: string;
  name: string;
  url: string;
  size: number | null;
  uploaded_by: string;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
  count?: number;
  message?: string;
}

export interface LoginResponse {
  token: string;
}

export interface AuthUser {
  user_id: string;
  role: Role;
  department_id: string | null;
}
