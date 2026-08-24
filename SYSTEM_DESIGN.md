# System Design Document: Last-Mile Delivery Management Platform

## 1. Rate Calculation Engine

The Rate Calculation Engine dynamically computes delivery charges for B2B and B2C shipments using volumetric sizing, billable weight slabs, zone classification, and Cash-on-Delivery (COD) surcharges without hardcoded rates.

### Volumetric and Billable Weight
Package cubic volume is converted to volumetric weight using the standard logistics divisor of 5000:
$$\text{Volumetric Weight (kg)} = \frac{\text{Length (cm)} \times \text{Width (cm)} \times \text{Height (cm)}}{5000}$$

The engine evaluates actual physical weight against volumetric weight to select the higher value as the billable weight:
$$\text{Billable Weight (kg)} = \max(\text{Actual Weight}, \text{Volumetric Weight})$$

### Dynamic Rate Card Resolution
Rates are stored in the database (`rate_cards` table) and indexed by order type (`B2B` vs. `B2C`) and geographic scope (`isIntraZone` boolean). Upon order creation or pre-confirmation pricing quote requests, the engine queries the exact rate card matching:
$$\text{order\_type} \in \{\text{B2B}, \text{B2C}\} \quad \text{AND} \quad \text{is\_intra\_zone} = (\text{Pickup Zone ID} == \text{Drop Zone ID})$$

Each rate card specifies a base fare, base weight slab (e.g., 5 kg), per-kilogram rate for excess weight, and a minimum guaranteed charge. Weight exceeding the base slab incurs an additional fee:
$$\text{Extra Weight (kg)} = \max(0, \text{Billable Weight} - \text{Base Weight Slab})$$
$$\text{Weight Charge} = \text{Extra Weight} \times \text{Per-Kg Rate}$$
$$\text{Freight Charge} = \max(\text{Minimum Charge}, \text{Base Fare} + \text{Weight Charge})$$

### COD Surcharge Logic
When the payment mode is Cash-on-Delivery (`COD`), an admin-configured surcharge (`surcharge_configs`) is applied. For B2C orders, a flat fee is appended; for B2B orders, a percentage surcharge is computed against the base freight charge. For Prepaid orders, the surcharge is zero.

$$\text{Total Charge} = \text{Freight Charge} + \text{COD Surcharge}$$

---

## 2. Zone Detection Approach

Zone detection maps physical addresses and pincodes to defined geographic zones (`zones` and `areas` tables) to determine intra-zone or inter-zone shipment routing.

### Bounding Box Spatial Resolution
Each zone defines geographic boundaries specified by minimum and maximum latitude and longitude coordinates (`min_lat`, `max_lat`, `min_lng`, `max_lng`). When pickup or drop coordinates are available, the zone service queries PostGIS / SQL spatial bounds:
$$\text{min\_lat} \le \text{Latitude} \le \text{max\_lat} \quad \text{AND} \quad \text{min\_lng} \le \text{Longitude} \le \text{max\_lng}$$

### Pincode Area Fallback
When explicit coordinates are absent, the service falls back to pincode mapping via the `areas` table. Each area record links a 6-digit pincode to a specific `zone_id`. The zone service executes an indexed SQL lookup:
$$\text{SELECT zone\_id FROM areas WHERE pincode} = \text{target\_pincode}$$

### Routing Classification
Comparing pickup and drop zone IDs classifies the order as:
- **Intra-Zone**: $\text{Pickup Zone ID} == \text{Drop Zone ID}$ (Shipment originates and terminates within the same territory).
- **Inter-Zone**: $\text{Pickup Zone ID} \neq \text{Drop Zone ID}$ (Cross-territory shipment requiring inter-zone line-haul rates).

---

## 3. Auto-Assignment Logic

The auto-assignment engine matches newly placed or rescheduled orders with the nearest active delivery agent using spatial proximity and operational status constraints.

### Eligibility Filtering
Only agents whose current duty status is `AVAILABLE` and whose profile matches the pickup zone or active fleet are evaluated. Agents flagged as `BUSY` (handling an active order) or `OFFLINE` are strictly excluded from assignment queries.

### Haversine Proximity Calculation
The algorithm retrieves the agent's latest broadcasted GPS coordinates (`current_lat`, `current_lng`) from `agent_profiles` and computes the spherical distance to the order's pickup coordinates using the Haversine formula:
$$d = 2r \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)} \right)$$

where $\phi$ is latitude, $\lambda$ is longitude, and $r = 6371\text{ km}$.

### State Update & Graceful Fallback
1. The candidate agent with the minimum distance $d$ is selected.
2. The order's `assigned_agent_id` is updated, and its status advances to `ASSIGNED`.
3. The assigned agent's duty status transitions to `BUSY`.
4. If no eligible agent is available, the order remains in `CREATED` status and is queued for manual admin dispatch without throwing unhandled exceptions.

---

## 4. Failed Delivery Handling

The platform handles non-delivery events through a structured state machine transition, automated customer notification, customer-initiated rescheduling, and agent reassignment.

### State Progression & Event Capture
When a delivery attempt fails (e.g., recipient unavailable), the agent submits a failure report (`PUT /api/agent/orders/:id/fail`). The Finite State Machine (FSM) validates the transition from `OUT_FOR_DELIVERY` to `FAILED`, records the reason in `order_status_history`, and sets the assigned agent's duty status back to `AVAILABLE`.

### Automated Notification & Customer Rescheduling
1. Upon entering `FAILED` status, an automated email notification is dispatched to the customer containing a direct link to reschedule.
2. The customer accesses their dashboard and submits a new preferred delivery date and notes (`POST /api/customer/orders/:id/reschedule`).
3. The FSM validates eligibility, updates `rescheduled_date`, and transitions the order status to `RESCHEDULED`.

### Reassignment & Audit Ledger
Following rescheduling, the auto-assignment engine selects an available eligible agent, reassigns the order, and transitions it to `ASSIGNED`. The previous failed attempt and full event history remain immutably preserved in `order_status_history` for complete auditability.
