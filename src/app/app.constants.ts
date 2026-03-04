export interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
}

// Thứ tự theo 4 tầng: Định hướng → Thiết kế → Đo lường → Thực thi
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',              icon: 'dashboard',           route: '/dashboard' },
  // Định hướng
  { label: 'Tầm nhìn',               icon: 'visibility',          route: '/visions' },
  { label: 'KSF',                    icon: 'rule',                 route: '/ksf',          roles: ['admin'] },
  // Thiết kế
  { label: 'Chiến lược',             icon: 'campaign',             route: '/strategies' },
  { label: 'Chuỗi giá trị',         icon: 'timeline',            route: '/value-chain',   roles: ['admin'] },
  // Đo lường
  { label: 'Objectives',             icon: 'track_changes',       route: '/objectives' },
  { label: 'The Big Picture',        icon: 'panorama',            route: '/big-picture' },
  { label: 'Strategy Radar',         icon: 'radar',               route: '/strategy' },
  // Thực thi
  { label: 'Team Activity',          icon: 'groups',              route: '/team-activity',  roles: ['admin', 'director', 'manager'] },
  { label: 'Subtasks',               icon: 'assignment_ind',       route: '/user-subtasks',  roles: ['admin', 'director', 'manager'] },
  { label: 'Chat',                   icon: 'chat',                route: '/chat' },
  { label: 'Admin',                  icon: 'admin_panel_settings', route: '/admin/users',   roles: ['admin'] },
];
