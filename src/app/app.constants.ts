export interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',          icon: 'dashboard',           route: '/dashboard' },
  { label: 'Objectives',         icon: 'track_changes',       route: '/objectives' },
  { label: 'Strategy Radar',     icon: 'radar',               route: '/strategy' },
  { label: 'The Big Picture',    icon: 'account_tree',        route: '/big-picture' },
  { label: 'Team Activity',      icon: 'groups',              route: '/team-activity',  roles: ['admin', 'director', 'manager'] },
  { label: 'Subtask theo user',  icon: 'assignment_ind',      route: '/user-subtasks',  roles: ['admin', 'director', 'manager'] },
  { label: 'Chat',               icon: 'chat',                route: '/chat' },
  { label: 'Admin',              icon: 'admin_panel_settings', route: '/admin/users',   roles: ['admin'] },
];
