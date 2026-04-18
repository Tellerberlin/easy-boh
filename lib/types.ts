export interface Profile {
  id: string;
  name: string | null;
  created_at: string;
}

export interface Restaurant {
  id: string;
  name: string;
  created_at: string;
}

export interface Permissions {
  can_invite?: boolean;
  can_approve_invitations?: boolean;
  can_approve_shifts?: boolean;
  can_edit_shifts?: boolean;
  can_view_all_shifts?: boolean;
  can_manage_departments?: boolean;
  can_manage_roles?: boolean;
}

export interface Role {
  id: string;
  restaurant_id: string;
  name: string;
  is_owner: boolean;
  permissions: Permissions;
  created_at: string;
}

export interface RestaurantMember {
  id: string;
  restaurant_id: string;
  profile_id: string;
  role_id: string;
  salary: number | null;
  hours_per_week: number | null;
  contract_start: string | null;
  contract_end: string | null;
  created_at: string;
  // joined
  profile?: Profile;
  role?: Role;
}

export interface Department {
  id: string;
  restaurant_id: string;
  name: string;
  created_at: string;
}

export interface DepartmentMember {
  id: string;
  department_id: string;
  profile_id: string;
  is_manager: boolean;
  created_at: string;
}

export interface Invitation {
  id: string;
  restaurant_id: string;
  invited_by: string;
  department_id: string | null;
  role_id: string | null;
  email: string;
  name: string | null;
  salary: number | null;
  hours_per_week: number | null;
  contract_start: string | null;
  status: "pending_approval" | "approved" | "sent" | "accepted";
  token: string;
  expires_at: string;
  created_at: string;
  // joined
  department?: Department;
  role?: Role;
  invited_by_profile?: Profile;
}

export interface TimeRecord {
  id: string;
  profile_id: string;
  restaurant_id: string;
  department_id: string | null;
  clocked_in_at: string;
  clocked_out_at: string | null;
  status: "active" | "pending" | "approved" | "rejected";
  edited_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  // joined
  profile?: Profile;
  department?: Department;
}

// Context stored in localStorage + derived on each load
export interface AppContext {
  restaurantId: string;
  restaurantName: string;
  memberId: string;
  role: Role;
  profileId: string;
  profileName: string | null;
}
