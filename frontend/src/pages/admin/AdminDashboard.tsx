import React, { useEffect, useState } from 'react';
import { HeroBanner } from '../../components/HeroBanner';
import { LiveTrackingModal } from '../../components/LiveTrackingModal';
import { apiClient } from '../../api/client';
import { Zone, RateCard, SurchargeConfig, Order, OrderStatus, OrderType, PaymentType } from '../../types';
import {
  MapPin,
  CreditCard,
  Package,
  Plus,
  Search,
  UserCheck,
  X,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  Truck,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'agents' | 'zones' | 'rates'>('orders');
  const [metrics, setMetrics] = useState<any>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [surcharges, setSurcharges] = useState<SurchargeConfig[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [trackingNumberSearch, setTrackingNumberSearch] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const [showAgentModal, setShowAgentModal] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    assignedZoneId: '',
  });

  const [showZoneModal, setShowZoneModal] = useState(false);
  const [newZone, setNewZone] = useState({ name: '', code: '', minLat: '', maxLat: '', minLng: '', maxLng: '' });

  const [showAreaModal, setShowAreaModal] = useState(false);
  const [newArea, setNewArea] = useState({ name: '', pincode: '', zoneId: '' });

  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('Area Name,Pincode,ZoneID\nIndiranagar,560038,zone-id-here\nKoramangala,560034,zone-id-here');

  const [showOnBehalfModal, setShowOnBehalfModal] = useState(false);
  const [onBehalfData, setOnBehalfData] = useState({
    customerId: '',
    pickupAddress: '',
    dropAddress: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    actualWeightKg: '',
    orderType: '',
    paymentType: '',
    pickupPincode: '',
    dropPincode: '',
  });

  const [selectedOrderForOverride, setSelectedOrderForOverride] = useState<Order | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<OrderStatus>(OrderStatus.IN_TRANSIT);
  const [overrideNotes, setOverrideNotes] = useState('');

  useEffect(() => {
    fetchAnalytics();
    fetchZones();
    fetchRateCards();
    fetchOrders();
    fetchAgents();
  }, [statusFilter, searchFilter]);

  const fetchAnalytics = async () => {
    try {
      const res = await apiClient.get('/admin/analytics/overview');
      if (res.data.success) {
        const d = res.data.data;
        setMetrics({
          totalOrders: d.deliveries.totalOrders,
          completed: d.deliveries.completed,
          active: d.deliveries.active,
          totalCustomers: d.customers,
          availableAgents: d.agents.statusBreakdown.available,
          totalRevenue: d.deliveries.totalRevenue,
        });
      }
    } catch (err) {}
  };

  const fetchAgents = async () => {
    try {
      const res = await apiClient.get('/admin/agents');
      if (res.data.success) setAgents(res.data.data);
    } catch (err) {}
  };

  const fetchZones = async () => {
    try {
      const res = await apiClient.get('/admin/zones');
      if (res.data.success) setZones(res.data.data);
    } catch (err) {}
  };

  const fetchRateCards = async () => {
    try {
      const resRate = await apiClient.get('/admin/rate-cards');
      const resSur = await apiClient.get('/admin/surcharges');
      if (resRate.data.success) setRateCards(resRate.data.data);
      if (resSur.data.success) setSurcharges(resSur.data.data);
    } catch (err) {}
  };

  const fetchOrders = async () => {
    try {
      let queryStr = `/admin/orders?limit=50`;
      if (statusFilter) queryStr += `&status=${statusFilter}`;
      if (searchFilter) queryStr += `&search=${encodeURIComponent(searchFilter)}`;
      const res = await apiClient.get(queryStr);
      if (res.data.success) setOrders(res.data.data.orders);
    } catch (err) {}
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/agents/create', {
        ...newAgent,
        assignedZoneId: newAgent.assignedZoneId || undefined,
      });
      alert(`Delivery Agent ${newAgent.name} provisioned successfully!`);
      setShowAgentModal(false);
      setNewAgent({ name: '', email: '', password: '', phone: '', assignedZoneId: '' });
      fetchAgents();
      fetchAnalytics();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create delivery agent.');
    }
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/zones', {
        name: newZone.name,
        code: newZone.code,
        minLat: newZone.minLat ? Number(newZone.minLat) : undefined,
        maxLat: newZone.maxLat ? Number(newZone.maxLat) : undefined,
        minLng: newZone.minLng ? Number(newZone.minLng) : undefined,
        maxLng: newZone.maxLng ? Number(newZone.maxLng) : undefined,
      });
      setShowZoneModal(false);
      setNewZone({ name: '', code: '', minLat: '', maxLat: '', minLng: '', maxLng: '' });
      fetchZones();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create zone.');
    }
  };

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/areas', newArea);
      setShowAreaModal(false);
      setNewArea({ name: '', pincode: '', zoneId: '' });
      fetchZones();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to map area.');
    }
  };

  const handleBulkCsv = async () => {
    try {
      const lines = csvText.trim().split('\n');
      const mappings: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 3) {
          mappings.push({
            name: parts[0].trim(),
            pincode: parts[1].trim(),
            zoneId: parts[2].trim(),
          });
        }
      }
      if (mappings.length === 0) {
        alert('No valid CSV rows parsed.');
        return;
      }
      const res = await apiClient.post('/admin/areas/bulk-csv', { mappings });
      alert(res.data.message);
      setShowCsvModal(false);
      fetchZones();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Bulk CSV import failed.');
    }
  };

  const [savingRateCardId, setSavingRateCardId] = useState<string | null>(null);

  const handleUpdateRateCard = async (id: string, card: RateCard) => {
    const baseFare = Number(card.base_fare);
    const baseWeightKg = Number(card.base_weight_kg);
    const perKgRate = Number(card.per_kg_rate);
    const minCharge = Number(card.min_charge);

    if (isNaN(baseFare) || baseFare < 0) {
      alert('Base fare must be a non-negative number.');
      return;
    }
    if (isNaN(baseWeightKg) || baseWeightKg <= 0) {
      alert('Base weight slab must be greater than 0 kg.');
      return;
    }
    if (isNaN(perKgRate) || perKgRate < 0) {
      alert('Per kg rate must be a non-negative number.');
      return;
    }
    if (isNaN(minCharge) || minCharge < 0) {
      alert('Minimum charge must be a non-negative number.');
      return;
    }

    try {
      setSavingRateCardId(id);
      await apiClient.put(`/admin/rate-cards/${id}`, {
        baseFare,
        baseWeightKg,
        perKgRate,
        minCharge,
      });
      alert(`Rate card for ${card.order_type} (${card.is_intra_zone ? 'Intra-Zone' : 'Inter-Zone'}) updated successfully!`);
      fetchRateCards();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update rate card.');
    } finally {
      setSavingRateCardId(null);
    }
  };

  const handleAutoAssign = async (orderId: string) => {
    try {
      const res = await apiClient.post(`/admin/orders/${orderId}/auto-assign`);
      alert(res.data.message);
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Auto-assignment failed.');
    }
  };

  const handleOverrideStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForOverride) return;
    try {
      await apiClient.put(`/admin/orders/${selectedOrderForOverride.id}/override-status`, {
        status: overrideStatus,
        notes: overrideNotes,
      });
      alert('Order status overridden successfully!');
      setSelectedOrderForOverride(null);
      setOverrideNotes('');
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Status override failed.');
    }
  };

  const handleCreateOnBehalf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onBehalfData.orderType) {
      alert('Please select an order type.');
      return;
    }
    if (!onBehalfData.paymentType) {
      alert('Please select a payment type.');
      return;
    }
    const lengthCm = Number(onBehalfData.lengthCm);
    const widthCm = Number(onBehalfData.widthCm);
    const heightCm = Number(onBehalfData.heightCm);
    const actualWeightKg = Number(onBehalfData.actualWeightKg);

    if (isNaN(lengthCm) || lengthCm <= 0 || isNaN(widthCm) || widthCm <= 0 || isNaN(heightCm) || heightCm <= 0) {
      alert('Please enter valid positive package dimensions.');
      return;
    }
    if (isNaN(actualWeightKg) || actualWeightKg <= 0) {
      alert('Please enter a valid positive actual weight.');
      return;
    }

    try {
      const res = await apiClient.post('/admin/orders/create-on-behalf', {
        ...onBehalfData,
        lengthCm,
        widthCm,
        heightCm,
        actualWeightKg,
        orderType: onBehalfData.orderType as OrderType,
        paymentType: onBehalfData.paymentType as PaymentType,
      });
      alert(`Order created successfully! Tracking #: ${res.data.data.trackingNumber}`);
      setShowOnBehalfModal(false);
      setOnBehalfData({
        customerId: '',
        pickupAddress: '',
        dropAddress: '',
        lengthCm: '',
        widthCm: '',
        heightCm: '',
        actualWeightKg: '',
        orderType: '',
        paymentType: '',
        pickupPincode: '',
        dropPincode: '',
      });
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'On-behalf order creation failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      <HeroBanner metrics={metrics} onTrackOrder={(trk) => setTrackingNumberSearch(trk)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex border-b border-slate-800 space-x-4 mb-8">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center space-x-2 py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === 'orders' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Orders & Overrides</span>
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className={`flex items-center space-x-2 py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === 'agents' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Manage Agents</span>
          </button>

          <button
            onClick={() => setActiveTab('zones')}
            className={`flex items-center space-x-2 py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === 'zones' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Zone Manager</span>
          </button>

          <button
            onClick={() => setActiveTab('rates')}
            className={`flex items-center space-x-2 py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === 'rates' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Dynamic Rate Cards</span>
          </button>
        </div>

        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search tracking # or customer..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full md:w-auto px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="CREATED">CREATED</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="PICKED_UP">PICKED UP</option>
                  <option value="IN_TRANSIT">IN TRANSIT</option>
                  <option value="OUT_FOR_DELIVERY">OUT FOR DELIVERY</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="FAILED">FAILED</option>
                  <option value="RESCHEDULED">RESCHEDULED</option>
                </select>
              </div>

              <button
                onClick={() => setShowOnBehalfModal(true)}
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-lg hover:shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Create Order On Behalf</span>
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold border-b border-slate-700">
                    <tr>
                      <th className="p-4">Tracking #</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Route</th>
                      <th className="p-4">Weight / Fare</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Assigned Agent</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-blue-400">
                          <button onClick={() => setTrackingNumberSearch(o.tracking_number)} className="hover:underline">
                            {o.tracking_number}
                          </button>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-white">{o.customer_name || 'Customer'}</p>
                          <p className="text-[10px] text-slate-500">{o.customer_email}</p>
                        </td>
                        <td className="p-4">
                          <p className="truncate max-w-xs">{o.pickup_address}</p>
                          <p className="text-[10px] text-slate-500 truncate max-w-xs">➡️ {o.drop_address}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-white">₹{o.total_charge}</p>
                          <p className="text-[10px] text-slate-400">{o.chargeable_weight_kg} kg ({o.order_type})</p>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            {o.status}
                          </span>
                        </td>
                        <td className="p-4 font-medium text-slate-300">
                          {o.agent_name || <span className="text-amber-400 italic">Unassigned</span>}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => handleAutoAssign(o.id)}
                            className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors"
                            title="Auto-Assign Nearest Agent"
                          >
                            Auto-Assign
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOrderForOverride(o);
                              setOverrideStatus(o.status);
                            }}
                            className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors"
                          >
                            Override
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">Delivery Agent Workforce Management</h3>
                <p className="text-xs text-slate-400">Provision and manage delivery agent accounts with strict server role enforcement</p>
              </div>
              <button
                onClick={() => setShowAgentModal(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-lg hover:shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Provision New Agent</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((a) => (
                <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/30">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{a.name}</p>
                        <span className="text-[10px] text-amber-400 font-mono font-bold">DELIVERY AGENT</span>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase ${
                        a.agent_status === 'AVAILABLE'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : a.agent_status === 'BUSY'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-slate-700 text-slate-400 border-slate-600'
                      }`}
                    >
                      {a.agent_status || 'AVAILABLE'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <p>📧 <strong>Email:</strong> {a.email}</p>
                    <p>📞 <strong>Phone:</strong> {a.phone}</p>
                    <p>📍 <strong>Zone:</strong> {a.assigned_zone_name || 'Unassigned'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'zones' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">Delivery Zones & Area Mapping</h3>
                <p className="text-xs text-slate-400">Manage bounding boxes and pincode mappings</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowAreaModal(true)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Map Single Area</span>
                </button>
                <button
                  onClick={() => setShowCsvModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg hover:shadow-emerald-500/20"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Bulk CSV Import</span>
                </button>
                <button
                  onClick={() => setShowZoneModal(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg hover:shadow-blue-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Zone</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {zones.map((z) => (
                <div key={z.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-base font-bold text-white">{z.name}</h4>
                      <span className="text-xs font-mono text-blue-400">{z.code}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700 text-slate-300">
                        {z.total_areas || 0} Pincodes Mapped
                      </span>
                    </div>
                  </div>

                  {z.min_lat && (
                    <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl text-xs space-y-1 font-mono text-slate-300">
                      <p>Lat Bounds: {z.min_lat} to {z.max_lat}</p>
                      <p>Lng Bounds: {z.min_lng} to {z.max_lng}</p>
                    </div>
                  )}

                  <div className="mt-4 text-xs font-mono text-slate-500">Zone ID: {z.id}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'rates' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">Dynamic B2B & B2C Rate Cards</h3>
                <p className="text-xs text-slate-400">Configure base fares, weight slabs, per-kg rates, and guaranteed minimum charges</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold border-b border-slate-700">
                    <tr>
                      <th className="p-4">Rate Category</th>
                      <th className="p-4">Base Fare (₹)</th>
                      <th className="p-4">Base Weight Slab (kg)</th>
                      <th className="p-4">Extra Per-Kg Rate (₹)</th>
                      <th className="p-4">Min Guaranteed Charge (₹)</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rateCards.map((card) => (
                      <tr key={card.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-bold">
                          <div className="flex items-center space-x-2">
                            <span className="text-blue-400 font-extrabold uppercase">
                              {card.order_type} ({card.is_intra_zone ? 'Intra-Zone' : 'Inter-Zone'})
                            </span>
                            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 border border-slate-700">
                              {card.is_intra_zone ? 'Same Region' : 'Cross Region'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            value={card.base_fare}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRateCards(rateCards.map((rc) => (rc.id === card.id ? { ...rc, base_fare: val } : rc)));
                            }}
                            className="w-28 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            value={card.base_weight_kg}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRateCards(rateCards.map((rc) => (rc.id === card.id ? { ...rc, base_weight_kg: val } : rc)));
                            }}
                            className="w-28 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            value={card.per_kg_rate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRateCards(rateCards.map((rc) => (rc.id === card.id ? { ...rc, per_kg_rate: val } : rc)));
                            }}
                            className="w-28 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            value={card.min_charge}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRateCards(rateCards.map((rc) => (rc.id === card.id ? { ...rc, min_charge: val } : rc)));
                            }}
                            className="w-28 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleUpdateRateCard(card.id, card)}
                            disabled={savingRateCardId === card.id}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-md hover:shadow-blue-500/20"
                          >
                            {savingRateCardId === card.id ? 'Saving...' : 'Save Rate Card'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white relative">
            <button onClick={() => setShowAgentModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-1">Provision Delivery Agent Account</h3>
            <p className="text-xs text-slate-400 mb-4">Admin-only creation of delivery agent credentials</p>

            <form onSubmit={handleCreateAgent} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium">Agent Full Name</label>
                <input
                  type="text"
                  required
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="John Agent"
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium">Email Address</label>
                <input
                  type="email"
                  required
                  value={newAgent.email}
                  onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                  placeholder="agent@delivery.com"
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium">Phone Number</label>
                <input
                  type="text"
                  required
                  value={newAgent.phone}
                  onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
                  placeholder="+1987654321"
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium">Initial Password</label>
                <input
                  type="password"
                  required
                  value={newAgent.password}
                  onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium">Assigned Zone (Optional)</label>
                <select
                  value={newAgent.assignedZoneId}
                  onChange={(e) => setNewAgent({ ...newAgent, assignedZoneId: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="">Unassigned</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.code})
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-3 rounded-xl text-xs mt-2">
                Provision Agent Account
              </button>
            </form>
          </div>
        </div>
      )}

      {showZoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white relative">
            <button onClick={() => setShowZoneModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Add Delivery Zone</h3>
            <form onSubmit={handleCreateZone} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium">Zone Name</label>
                <input
                  type="text"
                  required
                  value={newZone.name}
                  onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                  placeholder="West Zone"
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 font-medium">Zone Code</label>
                <input
                  type="text"
                  required
                  value={newZone.code}
                  onChange={(e) => setNewZone({ ...newZone, code: e.target.value })}
                  placeholder="ZONE_WEST"
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400">Min Lat</label>
                  <input
                    type="number"
                    step="any"
                    value={newZone.minLat}
                    onChange={(e) => setNewZone({ ...newZone, minLat: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Max Lat</label>
                  <input
                    type="number"
                    step="any"
                    value={newZone.maxLat}
                    onChange={(e) => setNewZone({ ...newZone, maxLat: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Min Lng</label>
                  <input
                    type="number"
                    step="any"
                    value={newZone.minLng}
                    onChange={(e) => setNewZone({ ...newZone, minLng: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Max Lng</label>
                  <input
                    type="number"
                    step="any"
                    value={newZone.maxLng}
                    onChange={(e) => setNewZone({ ...newZone, maxLng: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-3 rounded-xl text-xs mt-2">
                Create Zone
              </button>
            </form>
          </div>
        </div>
      )}

      {showAreaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white relative">
            <button onClick={() => setShowAreaModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Map Single Area to Zone</h3>
            <form onSubmit={handleCreateArea} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium">Area Name</label>
                <input
                  type="text"
                  required
                  value={newArea.name}
                  onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
                  placeholder="Indiranagar"
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 font-medium">Pincode (6 digits)</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={newArea.pincode}
                  onChange={(e) => setNewArea({ ...newArea, pincode: e.target.value })}
                  placeholder="560038"
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-300 font-medium">Target Zone</label>
                <select
                  required
                  value={newArea.zoneId}
                  onChange={(e) => setNewArea({ ...newArea, zoneId: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="">Select Zone</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.code})
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-3 rounded-xl text-xs mt-2">
                Map Area Pincode
              </button>
            </form>
          </div>
        </div>
      )}

      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-white relative">
            <button onClick={() => setShowCsvModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-2">Bulk CSV Pincode Importer</h3>
            <p className="text-xs text-slate-400 mb-4">Paste CSV rows: AreaName, Pincode, ZoneID</p>
            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={handleBulkCsv} className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-3 rounded-xl text-xs mt-4">
              Import Pincodes CSV
            </button>
          </div>
        </div>
      )}

      {selectedOrderForOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white relative">
            <button onClick={() => setSelectedOrderForOverride(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-2">Admin Status Override</h3>
            <p className="text-xs text-mono text-blue-400 mb-4">Tracking: {selectedOrderForOverride.tracking_number}</p>

            <form onSubmit={handleOverrideStatusSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium">Target Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as OrderStatus)}
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="CREATED">CREATED</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="PICKED_UP">PICKED UP</option>
                  <option value="IN_TRANSIT">IN TRANSIT</option>
                  <option value="OUT_FOR_DELIVERY">OUT FOR DELIVERY</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="FAILED">FAILED</option>
                  <option value="RESCHEDULED">RESCHEDULED</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium">Audit Note (Mandatory)</label>
                <textarea
                  required
                  rows={3}
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="Reason for admin manual status override..."
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-3 rounded-xl text-xs">
                Submit Status Override
              </button>
            </form>
          </div>
        </div>
      )}

      {showOnBehalfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-white relative my-8">
            <button onClick={() => setShowOnBehalfModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Create Order On Behalf of Customer</h3>

            <form onSubmit={handleCreateOnBehalf} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium">Customer User ID</label>
                <input
                  type="text"
                  required
                  value={onBehalfData.customerId}
                  onChange={(e) => setOnBehalfData({ ...onBehalfData, customerId: e.target.value })}
                  placeholder="Customer UUID"
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Pickup Address</label>
                  <input
                    type="text"
                    required
                    value={onBehalfData.pickupAddress}
                    onChange={(e) => setOnBehalfData({ ...onBehalfData, pickupAddress: e.target.value })}
                    placeholder="e.g. Rohini Sector 25, Delhi"
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium">Pickup Pincode</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={onBehalfData.pickupPincode}
                    onChange={(e) => setOnBehalfData({ ...onBehalfData, pickupPincode: e.target.value })}
                    placeholder="e.g. 110085"
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Drop Address</label>
                  <input
                    type="text"
                    required
                    value={onBehalfData.dropAddress}
                    onChange={(e) => setOnBehalfData({ ...onBehalfData, dropAddress: e.target.value })}
                    placeholder="e.g. Connaught Place, Block A, New Delhi"
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium">Drop Pincode</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={onBehalfData.dropPincode}
                    onChange={(e) => setOnBehalfData({ ...onBehalfData, dropPincode: e.target.value })}
                    placeholder="e.g. 110001"
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-slate-400">Length (cm)</label>
                  <input
                    type="number"
                    value={onBehalfData.lengthCm}
                    onChange={(e) => setOnBehalfData({ ...onBehalfData, lengthCm: e.target.value })}
                    placeholder="e.g. 30"
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Width (cm)</label>
                  <input
                    type="number"
                    value={onBehalfData.widthCm}
                    onChange={(e) => setOnBehalfData({ ...onBehalfData, widthCm: e.target.value })}
                    placeholder="e.g. 20"
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Height (cm)</label>
                  <input
                    type="number"
                    value={onBehalfData.heightCm}
                    onChange={(e) => setOnBehalfData({ ...onBehalfData, heightCm: e.target.value })}
                    placeholder="e.g. 15"
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Weight (kg)</label>
                  <input
                    type="number"
                    step="any"
                    value={onBehalfData.actualWeightKg}
                    onChange={(e) => setOnBehalfData({ ...onBehalfData, actualWeightKg: e.target.value })}
                    placeholder="e.g. 2.5"
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Order Type</label>
                  <select
                    value={onBehalfData.orderType}
                    onChange={(e) => setOnBehalfData({ ...onBehalfData, orderType: e.target.value as OrderType })}
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">Select order type</option>
                    <option value="B2C">B2C (Consumer)</option>
                    <option value="B2B">B2B (Business)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-medium">Payment Type</label>
                  <select
                    value={onBehalfData.paymentType}
                    onChange={(e) => setOnBehalfData({ ...onBehalfData, paymentType: e.target.value as PaymentType })}
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">Select payment type</option>
                    <option value="COD">Cash on Delivery (COD)</option>
                    <option value="PREPAID">Prepaid</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-3 rounded-xl text-xs mt-2">
                Create & Auto-Assign Order
              </button>
            </form>
          </div>
        </div>
      )}

      {trackingNumberSearch && (
        <LiveTrackingModal trackingNumber={trackingNumberSearch} onClose={() => setTrackingNumberSearch(null)} />
      )}
    </div>
  );
};
