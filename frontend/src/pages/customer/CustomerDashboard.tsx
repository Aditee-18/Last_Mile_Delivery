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
    pickupAddress: 'Connaught Place, Block A, New Delhi',
    dropAddress: 'Karol Bagh Metro Station, New Delhi',
    lengthCm: 30,
    widthCm: 20,
    heightCm: 15,
    actualWeightKg: 2.0,
    orderType: OrderType.B2C,
    paymentType: PaymentType.COD,
    pickupPincode: '110001',
    dropPincode: '110005',
  });

  const [selectedFailedOrder, setSelectedFailedOrder] = useState<Order | null>(null);
  const [rescheduledDate, setRescheduledDate] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  useEffect(() => {
    fetchMyOrders();
  }, []);

  const fetchMyOrders = async () => {
    try {
      const res = await apiClient.get('/customer/orders');
      if (res.data.success) setOrders(res.data.data);
    } catch (err) {}
  };

  const handleCalculateQuote = async () => {
    try {
      setIsCalculatingQuote(true);
      const res = await apiClient.post('/customer/orders/quote', {
        lengthCm: Number(bookingData.lengthCm),
        widthCm: Number(bookingData.widthCm),
        heightCm: Number(bookingData.heightCm),
        actualWeightKg: Number(bookingData.actualWeightKg),
        orderType: bookingData.orderType,
        paymentType: bookingData.paymentType,
        pickupPincode: bookingData.pickupPincode,
        dropPincode: bookingData.dropPincode,
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
    try {
      const res = await apiClient.post('/customer/orders/create', {
        ...bookingData,
        lengthCm: Number(bookingData.lengthCm),
        widthCm: Number(bookingData.widthCm),
        heightCm: Number(bookingData.heightCm),
        actualWeightKg: Number(bookingData.actualWeightKg),
      });
      alert(`Order Booked Successfully! Tracking Code: ${res.data.data.trackingNumber}`);
      setShowBookingModal(false);
      setQuote(null);
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
      alert('Order rescheduled successfully! Agent reassignment in progress.');
      setSelectedFailedOrder(null);
      setRescheduledDate('');
      setRescheduleNotes('');
      fetchMyOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Reschedule failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      <HeroBanner onTrackOrder={(trk) => setTrackingNumberSearch(trk)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div id="my-deliveries-section" className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8">
          <div>
            <h2 className="text-xl font-bold text-white">My Deliveries & Shipments</h2>
            <p className="text-xs text-slate-400">Track active orders, view quotes, or reschedule failed delivery attempts</p>
          </div>
          <button
            onClick={() => setShowBookingModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-3 rounded-2xl text-xs flex items-center space-x-2 transition-all shadow-lg hover:shadow-blue-500/25"
          >
            <Plus className="w-4 h-4" />
            <span>Book New Delivery</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((o) => (
            <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 relative flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
                  <span className="text-xs font-mono font-bold text-blue-400">{o.tracking_number}</span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                      o.status === OrderStatus.FAILED
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : o.status === OrderStatus.DELIVERED
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    }`}
                  >
                    {o.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">Pickup:</span>
                    <p className="text-slate-200 font-medium truncate">{o.pickup_address}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Drop:</span>
                    <p className="text-slate-200 font-medium truncate">{o.drop_address}</p>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-slate-400 border-t border-slate-800/80">
                    <span>Chargeable: <strong className="text-white">{o.chargeable_weight_kg} kg</strong></span>
                    <span>Total: <strong className="text-blue-400 font-extrabold text-sm">₹{o.total_charge}</strong></span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => setTrackingNumberSearch(o.tracking_number)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
                >
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Live Tracking</span>
                </button>

                {o.status === OrderStatus.FAILED && (
                  <button
                    onClick={() => setSelectedFailedOrder(o)}
                    className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-red-400" />
                    <span>Reschedule</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 text-white relative my-8 shadow-2xl">
            <button onClick={() => setShowBookingModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-1">Book New Delivery Order</h3>
            <p className="text-xs text-slate-400 mb-6">Enter package dimensions & addresses for instant pre-confirmation price breakdown</p>

            <form onSubmit={handleBookOrderSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Pickup Address</label>
                  <input
                    type="text"
                    required
                    value={bookingData.pickupAddress}
                    onChange={(e) => setBookingData({ ...bookingData, pickupAddress: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
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
                    value={bookingData.dropAddress}
                    onChange={(e) => setBookingData({ ...bookingData, dropAddress: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
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
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-slate-400">L (cm)</label>
                  <input
                    type="number"
                    value={bookingData.lengthCm}
                    onChange={(e) => setBookingData({ ...bookingData, lengthCm: Number(e.target.value) })}
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400">B (cm)</label>
                  <input
                    type="number"
                    value={bookingData.widthCm}
                    onChange={(e) => setBookingData({ ...bookingData, widthCm: Number(e.target.value) })}
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400">H (cm)</label>
                  <input
                    type="number"
                    value={bookingData.heightCm}
                    onChange={(e) => setBookingData({ ...bookingData, heightCm: Number(e.target.value) })}
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Weight (kg)</label>
                  <input
                    type="number"
                    step="any"
                    value={bookingData.actualWeightKg}
                    onChange={(e) => setBookingData({ ...bookingData, actualWeightKg: Number(e.target.value) })}
                    className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Order Type</label>
                  <select
                    value={bookingData.orderType}
                    onChange={(e) => setBookingData({ ...bookingData, orderType: e.target.value as OrderType })}
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    <option value="B2C">B2C (Consumer)</option>
                    <option value="B2B">B2B (Business)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-medium">Payment Type</label>
                  <select
                    value={bookingData.paymentType}
                    onChange={(e) => setBookingData({ ...bookingData, paymentType: e.target.value as PaymentType })}
                    className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  >
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
                  className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold py-2.5 rounded-xl text-xs"
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
