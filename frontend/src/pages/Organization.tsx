import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DataTable, StatusBadge, Spinner, KpiCard } from '../components/Components';
import { api } from '../api/client';

/* ── Types ── */
interface OrgUser { id: number; name: string; email: string; role: string; status: string; created_at: string; }

/* ── Helpers ── */
const roleBadge: Record<string, { color: string; label: string }> = {
  super_admin: { color: 'bg-accent-danger-bg text-accent-danger', label: 'Super Admin' },
  admin: { color: 'bg-accent-primary/10 text-accent-primary', label: 'Org Admin' },
  member: { color: 'bg-accent-info-bg text-accent-info', label: 'Member' },
};

export function OrgLayout() {
  const { t } = useTranslation();
  const subNav = [
    { to: '/org/api-keys', label: 'API Keys', end: false },
    { to: '/org/users', label: 'Users', end: false },
    { to: '/org/billing', label: 'Billing', end: false },
    { to: '/org/settings', label: 'Settings', end: false },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-fg-primary">Organization</h2>
        <p className="text-sm text-fg-tertiary mt-0.5">Manage your organization settings, users, and billing</p>
      </div>

      <nav className="flex gap-1 mb-6 border-b border-border">
        {subNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `px-5 py-3 text-sm font-medium border-b-[2px] -mb-[2px] transition-colors ${
                isActive
                  ? 'text-accent-primary border-accent-primary'
                  : 'text-fg-tertiary border-transparent hover:text-fg-secondary hover:border-border-strong'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

/* ════════════════════════ USERS PAGE ════════════════════════ */
export function UsersPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [stats, setStats] = useState<any>({});
  const [currentUserRole, setCurrentUserRole] = useState('member');
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = currentUserRole === 'super_admin';
  const canManage = currentUserRole === 'admin' || currentUserRole === 'super_admin';

  const loadUsers = () => {
    api.listUsers().then(data => {
      setUsers(data.users || []);
      setStats(data.stats || {});
      setCurrentUserRole(data.current_user_role || 'member');
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { loadUsers(); }, []);

  const handleRoleChange = async (userId: number, newRole: string) => {
    await api.updateUser(userId, { role: newRole });
    loadUsers();
  };
  const handleDisable = async (userId: number) => {
    await api.updateUser(userId, { status: 'disabled' });
    loadUsers();
  };

  if (loading) return <div className="py-12"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-fg-primary">Users</h3>
          <p className="text-sm text-fg-tertiary">Team members in your organization</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total Users" value={String(stats.total || 0)} accent="default" />
        <KpiCard label="Active" value={String(stats.active || 0)} accent="green" />
        <KpiCard label="Admins" value={String(stats.admins || 0)} accent="purple" />
      </div>

      <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
        <DataTable
          columns={[
            { key: 'user', header: 'User', render: (u: OrgUser) => (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-fg-inverse text-xs font-bold shrink-0"
                  style={{ background: u.name ? 'linear-gradient(135deg,#632CA6,#8B5CF6)' : '#e4e4e7' }}>
                  {u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm font-medium text-fg-primary">{u.name || '—'}</p>
                  <p className="text-xs text-fg-tertiary">{u.email}</p>
                </div>
              </div>
            ) },
            { key: 'role', header: 'Role', render: (u: OrgUser) => (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${roleBadge[u.role]?.color || 'bg-bg-muted text-fg-secondary'}`}>
                {roleBadge[u.role]?.label || u.role}
              </span>
            ) },
            { key: 'status', header: 'Status', render: (u: OrgUser) => <StatusBadge status={u.status} size="sm" /> },
            { key: 'joined', header: 'Joined', render: (u: OrgUser) => (
              <span className="text-sm text-fg-tertiary">{u.created_at?.split('T')[0] || u.created_at}</span>
            ) },
            ...(canManage ? [{ key: 'actions' as string, header: '', render: (u: OrgUser) => (
              <div className="flex items-center gap-1">
                {u.role === 'member' ? (
                  <button onClick={(e) => { e.stopPropagation(); handleRoleChange(u.id, 'admin'); }}
                    className="px-2 py-1 text-xs text-accent-primary hover:bg-accent-primary/10 rounded transition-colors">Promote to Admin</button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); handleRoleChange(u.id, 'member'); }}
                    className="px-2 py-1 text-xs text-accent-warning hover:bg-accent-warning-bg rounded transition-colors">Demote to Member</button>
                )}
                {u.status === 'active' && (
                  <button onClick={(e) => { e.stopPropagation(); handleDisable(u.id); }}
                    className="px-2 py-1 text-xs text-accent-danger hover:bg-accent-danger-bg rounded transition-colors">Disable</button>
                )}
              </div>
            ) }] : []),
          ]}
          rows={users}
          emptyMessage="No users in this organization"
        />
      </div>

      {!canManage && (
        <div className="bg-bg-subtle border border-border rounded-lg p-4 text-sm text-fg-tertiary text-center">
          Contact your organization admin to manage user roles and permissions.
        </div>
      )}
      {isSuperAdmin && (
        <div className="bg-accent-danger-bg border border-accent-danger rounded-lg p-3 text-xs text-accent-danger text-center">
          Platform Super Admin — you can manage users across all organizations and modify pricing.
        </div>
      )}
    </div>
  );
}

/* ════════════════════════ SETTINGS PAGE ════════════════════════ */
export function SettingsPage() {
  const [org, setOrg] = useState<any>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [role, setRole] = useState('member');
  const isAdmin = role === 'admin' || role === 'super_admin';

  useEffect(() => {
    api.getOrganization().then(d => {
      setOrg(d.organization);
      setName(d.organization.name);
      setRole(d.current_user_role);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      await api.updateOrganization({ name });
      setMsg('Saved successfully');
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  if (!org) return <div className="py-12"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-bg-elevated border border-border rounded-lg p-6">
        <h3 className="text-sm font-semibold text-fg-primary mb-4">Organization Settings</h3>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-fg-tertiary uppercase tracking-wider mb-1.5">Organization Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} disabled={!isAdmin}
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-bg-elevated text-fg-primary focus:outline-none focus:border-accent-info disabled:bg-bg-subtle disabled:text-fg-tertiary" />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-fg-tertiary">Slug:</span> <code className="text-fg-primary">{org.slug}</code></div>
            <div><span className="text-fg-tertiary">Created:</span> <span className="text-fg-primary">{org.created_at?.split('T')[0]}</span></div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-[#007bff] text-white text-sm font-medium rounded-md hover:bg-[#0069d9] disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {msg && <span className={`text-sm ${msg.includes('success') ? 'text-[#28a745]' : 'text-[#dc3545]'}`}>{msg}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Organization Stats */}
      <div className="bg-bg-elevated border-border rounded-lg p-6">
        <h3 className="text-sm font-semibold text-[#212529] mb-4">Organization Info</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="p-4 bg-[#f8f9fa] rounded-md">
            <p className="text-[#6c757d]">Members</p>
            <p className="text-xl font-bold text-[#212529]">0</p>
          </div>
          <div className="p-4 bg-[#f8f9fa] rounded-md">
            <p className="text-[#6c757d]">Active Subscriptions</p>
            <p className="text-xl font-bold text-[#212529]">0</p>
          </div>
          <div className="p-4 bg-[#f8f9fa] rounded-md">
            <p className="text-[#6c757d]">Your Role</p>
            <p className="text-xl font-bold text-[#212529] capitalize">{role.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-[#f8f9fa] border border-[#dee2e6] rounded-lg p-4 text-sm text-[#6c757d] text-center">
          Only organization admins can modify organization settings.
        </div>
      )}
    </div>
  );
}
