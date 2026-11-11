"use client";

import React, { useState, useMemo, useEffect } from "react";
import { FilterIcon, ExportIcon, PlusIcon } from "../icons";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Store Manager" | "Store Attendant" | "Accountant" | "Dispatch Coordinator";
  status: "Active" | "Invited";
  lastActive: string;
  permissions: {
    canManageOrders: boolean;
    canManageInventory: boolean;
    canViewPayouts: boolean;
    canProcessRefunds: boolean;
    canOverrideCopilot: boolean;
  };
}

interface AuditEvent {
  id: string;
  actor: string;
  actorType: "OWNER" | "STAFF" | "AI_COPILOT" | "MONNIFY";
  action: string;
  target: string;
  category: "ORDERS" | "INVENTORY" | "PAYOUTS" | "SETTINGS";
  timestamp: string;
  details?: string;
}

interface TeamViewProps {
  vendorName?: string;
}

export function TeamView({ vendorName }: TeamViewProps) {
  const [activeTab, setActiveTab] = useState<"roles" | "audit">("roles");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamMember["role"]>("Store Attendant");
  const [invitePerms, setInvitePerms] = useState({
    canManageOrders: true,
    canManageInventory: true,
    canViewPayouts: false,
    canProcessRefunds: false,
    canOverrideCopilot: true,
  });
  const [inviteSuccessToast, setInviteSuccessToast] = useState<string | null>(null);

  // Audit Filters
  const [auditSearch, setAuditSearch] = useState("");
  const [actorFilter, setActorFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Team Data (defaults to authenticated store owner)
  const [members, setMembers] = useState<TeamMember[]>([
    {
      id: "mem-owner",
      name: vendorName || "Store Owner",
      email: "owner@caterlog.store",
      role: "Owner",
      status: "Active",
      lastActive: "Now",
      permissions: {
        canManageOrders: true,
        canManageInventory: true,
        canViewPayouts: true,
        canProcessRefunds: true,
        canOverrideCopilot: true,
      },
    },
  ]);

  // Keep owner name in sync with vendor name
  useEffect(() => {
    if (vendorName) {
      setMembers((prev) =>
        prev.map((m) => (m.id === "mem-owner" ? { ...m, name: vendorName } : m))
      );
    }
  }, [vendorName]);

  // Audit Trail (starts clean; filled as live operations occur)
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);

  // Handle Team Member Invitation
  const handleSendInvite = () => {
    if (!inviteEmail || !inviteName) return;
    const newMember: TeamMember = {
      id: `mem-${Date.now()}`,
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      status: "Invited",
      lastActive: "Pending",
      permissions: invitePerms,
    };
    setMembers((prev) => [...prev, newMember]);

    // Record in Audit Log
    const logEvent: AuditEvent = {
      id: `aud-${Date.now()}`,
      actor: vendorName || "Store Owner",
      actorType: "OWNER",
      action: `Invited New Team Member (${inviteRole})`,
      target: inviteEmail,
      category: "SETTINGS",
      timestamp: "Just now",
      details: `Granted: ${Object.entries(invitePerms)
        .filter(([, v]) => v)
        .map(([k]) => k.replace("can", ""))
        .join(", ")}`,
    };
    setAuditLogs((prev) => [logEvent, ...prev]);

    setInviteSuccessToast(`Invitation sent to ${inviteEmail}!`);
    setTimeout(() => setInviteSuccessToast(null), 3000);
    setInviteEmail("");
    setInviteName("");
    setInviteModalOpen(false);
  };

  // Filtered Audit Logs
  const filteredAudit = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesSearch =
        log.actor.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.target.toLowerCase().includes(auditSearch.toLowerCase());
      const matchesActor = actorFilter === "ALL" || log.actorType === actorFilter;
      const matchesCategory = categoryFilter === "ALL" || log.category === categoryFilter;
      return matchesSearch && matchesActor && matchesCategory;
    });
  }, [auditLogs, auditSearch, actorFilter, categoryFilter]);

  // Export Audit CSV
  const handleExportAudit = () => {
    const headers = ["Timestamp", "Actor", "Actor Type", "Action", "Target", "Category", "Details"];
    const rows = filteredAudit.map((e) => [
      `"${e.timestamp}"`,
      `"${e.actor}"`,
      e.actorType,
      `"${e.action}"`,
      `"${e.target}"`,
      e.category,
      `"${e.details || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `caterlog-audit-log-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {inviteSuccessToast && (
        <div className="fixed top-18 right-8 z-50 bg-[#0d5c3a] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <span>✓</span>
          <span>{inviteSuccessToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            Team & Activity Log
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Manage staff roles, operational permissions, and monitor the chronological audit log.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "audit" ? (
            <button
              onClick={handleExportAudit}
              className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-white border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition-all shadow-2xs hover:shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <ExportIcon className="w-3.5 h-3.5 text-gray-500" />
              <span>Export Audit CSV</span>
            </button>
          ) : (
            <button
              onClick={() => setInviteModalOpen(true)}
              className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white transition-all shadow-2xs hover:shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Invite Team Member</span>
            </button>
          )}
        </div>
      </div>

      {/* View Sub-Tabs */}
      <div className="flex border-b border-gray-200 text-xs font-semibold gap-6">
        <button
          onClick={() => setActiveTab("roles")}
          className={`pb-2.5 border-b-2 transition-all cursor-pointer active:scale-95 ${
            activeTab === "roles"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
          }`}
        >
          Team Permissions & Roles ({members.length})
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`pb-2.5 border-b-2 transition-all cursor-pointer active:scale-95 ${
            activeTab === "audit"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
          }`}
        >
          Activity & Audit Log ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: Team & Permissions (Matching Team Permissions & Roles.png) */}
      {activeTab === "roles" && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Staff</div>
              <div className="text-2xl font-extrabold text-gray-900 mt-2">{members.length} Members</div>
              <div className="text-xs text-emerald-600 font-semibold mt-1">
                {members.filter((m) => m.status === "Active").length} active now
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Security Model</div>
              <div className="text-2xl font-extrabold text-gray-900 mt-2">Role-Based (RBAC)</div>
              <div className="text-xs text-gray-500 mt-1">Granular financial & order controls</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Co-Pilot Overrides</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-2">
                {members.filter((m) => m.permissions.canOverrideCopilot).length} Operators
              </div>
              <div className="text-xs text-gray-500 mt-1">Can takeover live WhatsApp chats</div>
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead className="bg-gray-50/60 text-[11px] uppercase font-bold text-gray-400 border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-6">Member</th>
                    <th className="py-3 px-6">Role</th>
                    <th className="py-3 px-6">Assigned Permissions</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0">
                            {m.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-xs">{m.name}</div>
                            <div className="text-[11px] text-gray-400">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-xs font-semibold text-gray-800 bg-gray-100 px-2.5 py-1 rounded-lg">
                          {m.role}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs text-gray-600">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {m.permissions.canManageOrders && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-md">
                              Orders
                            </span>
                          )}
                          {m.permissions.canManageInventory && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md">
                              Stock
                            </span>
                          )}
                          {m.permissions.canViewPayouts && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded-md">
                              Payouts
                            </span>
                          )}
                          {m.permissions.canOverrideCopilot && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded-md">
                              Co-Pilot
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            m.status === "Active"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {m.role !== "Owner" && (
                          <button
                            onClick={() => setEditMember(m)}
                            className="text-xs font-semibold px-3 py-1 rounded-lg border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition-all cursor-pointer active:scale-95"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Activity & Audit Log (Matching Team Activity Log.png) */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          {/* Audit Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Search audit actions, SKU, order code..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Actors</option>
                <option value="STAFF">Human Staff</option>
                <option value="AI_COPILOT">AI Co-Pilot</option>
                <option value="MONNIFY">Monnify System</option>
                <option value="OWNER">Store Owner</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="ORDERS">Orders & Dispatch</option>
                <option value="INVENTORY">Inventory & Stock</option>
                <option value="PAYOUTS">Settlement & Splits</option>
                <option value="SETTINGS">Settings & Integrations</option>
              </select>
            </div>
          </div>

          {/* Audit Trail List */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
            <div className="divide-y divide-gray-100">
              {filteredAudit.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto text-xl">
                    📜
                  </div>
                  <div className="text-xs font-bold text-gray-900">No team audit logs yet</div>
                  <div className="text-xs text-gray-400 max-w-sm mx-auto">
                    Actions performed by store staff, riders, or automated webhook workers will be recorded here in an immutable audit ledger.
                  </div>
                </div>
              ) : (
                filteredAudit.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/70 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                          log.actorType === "AI_COPILOT"
                            ? "bg-emerald-100 text-emerald-800"
                            : log.actorType === "MONNIFY"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {log.actorType === "AI_COPILOT"
                          ? "🤖"
                          : log.actorType === "MONNIFY"
                          ? "💳"
                          : "👤"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-900">{log.action}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold">
                            {log.target}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          By <span className="font-semibold text-gray-800">{log.actor}</span>
                          {log.details && <span> — {log.details}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center pl-12 sm:pl-0">
                      <span className="text-[11px] font-semibold text-gray-400 whitespace-nowrap">
                        {log.timestamp}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          log.category === "ORDERS"
                            ? "bg-emerald-50 text-emerald-700"
                            : log.category === "PAYOUTS"
                            ? "bg-purple-50 text-purple-700"
                            : log.category === "INVENTORY"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {log.category}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in duration-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Invite Team Member</h3>
                <p className="text-xs text-gray-500 mt-0.5">Add staff to help manage orders and WhatsApp chat.</p>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Segun Adebayo"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  placeholder="segun@niastores.ng"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Role Preset</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="Store Attendant">Store Attendant (Orders & Chat)</option>
                  <option value="Store Manager">Store Manager (Orders, Stock, Price)</option>
                  <option value="Dispatch Coordinator">Dispatch Coordinator (Pickup & Delivery)</option>
                  <option value="Accountant">Accountant (Financials & Settlement)</option>
                </select>
              </div>

              {/* Permissions Checkboxes */}
              <div className="border border-gray-100 rounded-2xl p-4 space-y-2 bg-gray-50/50">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Customized Permissions
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invitePerms.canManageOrders}
                    onChange={(e) => setInvitePerms({ ...invitePerms, canManageOrders: e.target.checked })}
                    className="rounded text-emerald-600 cursor-pointer"
                  />
                  <span className="text-gray-700">Can view & update order status</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invitePerms.canManageInventory}
                    onChange={(e) => setInvitePerms({ ...invitePerms, canManageInventory: e.target.checked })}
                    className="rounded text-emerald-600 cursor-pointer"
                  />
                  <span className="text-gray-700">Can update stock counts & wholesale margins</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invitePerms.canOverrideCopilot}
                    onChange={(e) => setInvitePerms({ ...invitePerms, canOverrideCopilot: e.target.checked })}
                    className="rounded text-emerald-600 cursor-pointer"
                  />
                  <span className="text-gray-700">Can takeover WhatsApp AI Co-Pilot conversations</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invitePerms.canViewPayouts}
                    onChange={(e) => setInvitePerms({ ...invitePerms, canViewPayouts: e.target.checked })}
                    className="rounded text-emerald-600 cursor-pointer"
                  />
                  <span className="text-gray-700">Can view Monnify settlement accounts & payout splits</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setInviteModalOpen(false)}
                className="px-4 py-2 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvite}
                disabled={!inviteEmail || !inviteName}
                className="bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-50 text-white font-semibold text-xs py-2 px-5 rounded-xl shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Edit {editMember.name}</h3>
              <button onClick={() => setEditMember(null)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-500 font-semibold mb-1">Role</label>
                <select
                  value={editMember.role}
                  onChange={(e) => setEditMember({ ...editMember, role: e.target.value as any })}
                  className="w-full p-2 border rounded-xl bg-white cursor-pointer"
                >
                  <option value="Store Manager">Store Manager</option>
                  <option value="Store Attendant">Store Attendant</option>
                  <option value="Dispatch Coordinator">Dispatch Coordinator</option>
                  <option value="Accountant">Accountant</option>
                </select>
              </div>
              <div className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editMember.permissions.canManageOrders}
                    onChange={(e) =>
                      setEditMember({
                        ...editMember,
                        permissions: { ...editMember.permissions, canManageOrders: e.target.checked },
                      })
                    }
                    className="rounded text-emerald-600"
                  />
                  <span>Can manage orders & mark dispatched</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editMember.permissions.canOverrideCopilot}
                    onChange={(e) =>
                      setEditMember({
                        ...editMember,
                        permissions: { ...editMember.permissions, canOverrideCopilot: e.target.checked },
                      })
                    }
                    className="rounded text-emerald-600"
                  />
                  <span>Can override WhatsApp Co-Pilot</span>
                </label>
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <button
                onClick={() => {
                  setMembers(members.filter((m) => m.id !== editMember.id));
                  setEditMember(null);
                }}
                className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Remove Staff
              </button>
              <button
                onClick={() => {
                  setMembers(members.map((m) => (m.id === editMember.id ? editMember : m)));
                  setEditMember(null);
                }}
                className="bg-[#0d5c3a] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#0b4b2f] cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

