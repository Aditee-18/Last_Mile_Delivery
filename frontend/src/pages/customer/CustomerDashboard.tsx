import React, { useEffect, useState } from 'react';
import { HeroBanner } from '../../components/HeroBanner';
import { LiveTrackingModal } from '../../components/LiveTrackingModal';
import { apiClient } from '../../api/client';
import { Order, OrderType, PaymentType, OrderStatus, QuoteBreakdown } from '../../types';
import { Package, Plus, Clock, AlertTriangle, ArrowRight, ShieldCheck, X, RefreshCw } from 'lucide-react';

export const CustomerDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [trackingNumberSearch, setTrackingNumberSearch] = useState<string | null>(null);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [isCalculatingQuote, setIsCalculatingQuote] = useState(false);

  const [bookingData, setBookingData] = useState({
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

  const [selectedFailedOrder, setSelectedFailedOrder] = useState<Order | null>(null);
  const [rescheduledDate, setRescheduledDate] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  const [publicMetrics, setPublicMetrics] = useState<{
    completedDeliveries?: number;
    activeShipments?: number;
    registeredCustomers?: number;
    deliverySuccessRate?: string;
  }>({});

  useEffect(() => {
    fetchMyOrders();
    fetchPublicMetrics();
  }, []);

  const fetchPublicMetrics = async () => {
    try {
      const res = await apiClient.get('/analytics/public');
      if (res.data.success) setPublicMetrics(res.data.data);
    } catch (err) {}
  };

  const fetchMyOrders = async () => {
    try {
      const res = await apiClient.get('/customer/orders');
      if (res.data.success) setOrders(res.data.data);
    } catch (err) {}
  };

  const handleCalculateQuote = async () => {
    if (!bookingData.orderType) {
      alert('Please select an order type.');
      return;
    }
    if (!bookingData.paymentType) {
      alert('Please select a payment type.');
      return;
    }
    const lengthCm = Number(bookingData.lengthCm);
    const widthCm = Number(bookingData.widthCm);
    const heightCm = Number(bookingData.heightCm);
    const actualWeightKg = Number(bookingData.actualWeightKg);

    if (isNaN(lengthCm) || lengthCm <= 0 || isNaN(widthCm) || widthCm <= 0 || isNaN(heightCm) || heightCm <= 0) {
      alert('Please enter valid positive package dimensions.');
      return;
    }
    if (isNaN(actualWeightKg) || actualWeightKg <= 0) {
      alert('Please enter a valid positive actual weight.');
      return;
    }

    try {
      setIsCalculatingQuote(true);
      const res = await apiClient.post('/customer/orders/quote', {
        lengthCm,
        widthCm,
        heightCm,
        actualWeightKg,
        orderType: bookingData.orderType as OrderType,
        paymentType: bookingData.paymentType as PaymentType,
        pickupPincode: bookingData.pickupPincode.trim() || undefined,
        dropPincode: bookingData.dropPincode.trim() || undefined,
      });
      if (res.data.success) {
        setQuote(res.data.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to calculate quote.');
    } finally {
      setIsCalculatingQuote(false);
    }
  };

  const handleBookOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingData.orderType) {
      alert('Please select an order type.');
      return;
    }
    if (!bookingData.paymentType) {
      alert('Please select a payment type.');
      return;
    }
    const lengthCm = Number(bookingData.lengthCm);
    const widthCm = Number(bookingData.widthCm);
    const heightCm = Number(bookingData.heightCm);
    const actualWeightKg = Number(bookingData.actualWeightKg);

    if (isNaN(lengthCm) || lengthCm <= 0 || isNaN(widthCm) || widthCm <= 0 || isNaN(heightCm) || heightCm <= 0) {
      alert('Please enter valid positive package dimensions.');
      return;
    }
    if (isNaN(actualWeightKg) || actualWeightKg <= 0) {
      alert('Please enter a valid positive actual weight.');
      return;
    }

    try {
      const res = await apiClient.post('/customer/orders/create', {
        ...bookingData,
        lengthCm,
        widthCm,
        heightCm,
        actualWeightKg,
        orderType: bookingData.orderType as OrderType,
        paymentType: bookingData.paymentType as PaymentType,
        pickupPincode: bookingData.pickupPincode.trim() || undefined,
        dropPincode: bookingData.dropPincode.trim() || undefined,
      });
      alert(`Order Booked Successfully! Tracking Code: ${res.data.data.trackingNumber}`);
      setShowBookingModal(false);
      setQuote(null);
      setBookingData({
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
      fetchMyOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Order booking failed.');
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFailedOrder) return;
    try {
      await apiClient.post(`/customer/orders/${selectedFailedOrder.id}/reschedule`, {
        rescheduledDate,
        notes: rescheduleNotes,
      });
      alert('Delivery attempt rescheduled successfully!');
      setSelectedFailedOrder(null);
      setRescheduledDate('');
      setRescheduleNotes('');
      fetchMyOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Reschedule failed.');
    }
  };

  const completedCount = orders.filter((o) => o.status === OrderStatus.DELIVERED).length;
  const activeCount = orders.filter((o) =>
    ['CREATED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(o.status)
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      <HeroBanner
        metrics={publicMetrics}
        onTrackOrder={(trk) => setTrackingNumberSearch(trk)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div id="my-deliveries-section" className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8">
          <div>
            <h2 className="text-xl font-bold text-white">My Deliveries & Shipments</h2>
            <p className="text-xs text-slate-400">Track active orders, view quotes, or reschedule failed delivery attempts</p>
          </div>
          <button
            onClick={() => {
              setQuote(null);
              setShowBookingModal(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-5 py-3 rounded-2xl text-xs flex items-center space-x-2 transition-all shadow-lg hover:shadow-blue-500/25"
          >
            <Plus className="w-4 h-4" />
            <span>Book New Delivery</span>
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-bold text-white mb-1">No orders found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
              You haven't placed any delivery orders yet. Click below to book your first shipment.
            </p>
            <button
              onClick={() => {
                setQuote(null);
                setShowBookingModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs inline-flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Book First Delivery</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((o) => (
              <div
                key={o.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 relative hover:border-slate-700 transition-colors shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-mono font-bold text-blue-400">{o.tracking_number}</span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        o.status === OrderStatus.DELIVERED
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : o.status === OrderStatus.FAILED
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 mt-3">
                    <p>📍 <strong>Pickup:</strong> {o.pickup_address}</p>
                    <p>🏁 <strong>Drop:</strong> {o.drop_address}</p>
                    <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800/80">
                      <span>Weight: <strong className="text-white">{o.chargeable_weight_kg} kg</strong></span>
                      <span>Total: <strong className="text-emerald-400">₹{o.total_charge}</strong></span>
                    </div>
                    {o.agent_name && (
                      <p className="text-[11px] text-slate-400 pt-1">
                        🚚 Agent: <strong className="text-white">{o.agent_name}</strong> ({o.agent_phone})
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setTrackingNumberSearch(o.tracking_number)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1"
                  >
                    <span>Track Order</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {o.status === OrderStatus.FAILED && (
                    <button
                      onClick={() => setSelectedFailedOrder(o)}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center space-x-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reschedule</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-white relative shadow-2xl my-8">
            <button onClick={() => setShowBookingModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-1">Book New Delivery Order</h3>
            <p className="text-xs text-slate-400 mb-6">Enter package specs & address details for real-time rate quote</p>

            <form onSubmit={handleBookOrderSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Pickup Address</label>
                  <input
                    type="text"
                    required
                    value={bookingData.pickupAddress}
                    onChange={(e) => setBookingData({ ...bookingData, pickupAddress: e.target.value })}
                    placeholder="e.g. Rohini Sector 25, Delhi"
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium">Pickup Pincode</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={bookingData.pickupPincode}
                    onChange={(e) => setBookingData({ ...bookingData, pickupPincode: e.target.value })}
                    placeholder="e.g. 110085"
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Drop Address</label>
                  <input
                    type="text"
                    required
                    value={bookingData.dropAddress}
                    onChange={(e) => setBookingData({ ...bookingData, dropAddress: e.target.value })}
                    placeholder="e.g. Connaught Place, Block A, New Delhi"
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium">Drop Pincode</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={bookingData.dropPincode}
                    onChange={(e) => setBookingData({ ...bookingData, dropPincode: e.target.value })}
                    placeholder="e.g. 110001"
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-slate-400">L (cm)</label>
                  <input
                    type="number"
                    value={bookingData.lengthCm}
                    onChange={(e) => setBookingData({ ...bookingData, lengthCm: e.target.value })}
                    placeholder="e.g. 30"
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400">B (cm)</label>
                  <input
                    type="number"
                    value={bookingData.widthCm}
                    onChange={(e) => setBookingData({ ...bookingData, widthCm: e.target.value })}
                    placeholder="e.g. 20"
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400">H (cm)</label>
                  <input
                    type="number"
                    value={bookingData.heightCm}
                    onChange={(e) => setBookingData({ ...bookingData, heightCm: e.target.value })}
                    placeholder="e.g. 15"
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Weight (kg)</label>
                  <input
                    type="number"
                    step="any"
                    value={bookingData.actualWeightKg}
                    onChange={(e) => setBookingData({ ...bookingData, actualWeightKg: e.target.value })}
                    placeholder="e.g. 2.5"
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Order Type</label>
                  <select
                    value={bookingData.orderType}
                    onChange={(e) => setBookingData({ ...bookingData, orderType: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select order type</option>
                    <option value="B2C">B2C (Consumer)</option>
                    <option value="B2B">B2B (Business)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-medium">Payment Type</label>
                  <select
                    value={bookingData.paymentType}
                    onChange={(e) => setBookingData({ ...bookingData, paymentType: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select payment type</option>
                    <option value="COD">Cash on Delivery (COD)</option>
                    <option value="PREPAID">Prepaid</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex space-x-3">
                <button
                  type="button"
                  onClick={handleCalculateQuote}
                  disabled={isCalculatingQuote}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors"
                >
                  {isCalculatingQuote ? 'Calculating...' : 'Preview Price Quote'}
                </button>
              </div>

              {quote && (
                <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-2 text-xs animate-in fade-in duration-150">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Volumetric Weight:</span>
                    <span className="font-bold text-white">{quote.volumetricWeightKg} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Chargeable Weight:</span>
                    <span className="font-bold text-white">{quote.chargeableWeightKg} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Zone Classification:</span>
                    <span className="font-bold text-blue-400">{quote.isIntraZone ? 'Intra-Zone (Same Region)' : 'Inter-Zone (Cross Region)'}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-700/80 pt-2">
                    <span className="text-slate-300 font-bold">Total Estimated Charge:</span>
                    <span className="font-extrabold text-blue-400 text-sm">₹{quote.totalCharge}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl text-xs transition-all shadow-lg hover:shadow-blue-500/25 mt-4"
              >
                Confirm & Book Delivery Order
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedFailedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white relative">
            <button onClick={() => setSelectedFailedOrder(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-2">Reschedule Failed Delivery</h3>
            <p className="text-xs text-slate-400 mb-4">Select a new date for re-attempt delivery</p>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium">New Delivery Date</label>
                <input
                  type="date"
                  required
                  value={rescheduledDate}
                  onChange={(e) => setRescheduledDate(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium">Notes / Special Instructions</label>
                <textarea
                  rows={3}
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  placeholder="Please attempt delivery after 5 PM..."
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <button type="submit" className="w-full bg-red-600 hover:bg-red-500 font-bold py-3 rounded-xl text-xs">
                Confirm Reschedule & Reassign Agent
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
