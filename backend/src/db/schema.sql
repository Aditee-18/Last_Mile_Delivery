DO $$ 
BEGIN 
  CREATE EXTENSION IF NOT EXISTS postgis; 
EXCEPTION WHEN OTHERS THEN 
  RAISE NOTICE 'PostGIS extension not available on this server, falling back to standard SQL spatial calculations.';
END $$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if exists (for clean migration reset)
DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS agent_profiles CASCADE;
DROP TABLE IF EXISTS surcharge_configs CASCADE;
DROP TABLE IF EXISTS rate_cards CASCADE;
DROP TABLE IF EXISTS areas CASCADE;
DROP TABLE IF EXISTS zones CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Custom Enums
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('ADMIN', 'CUSTOMER', 'DELIVERY_AGENT');

DROP TYPE IF EXISTS order_type CASCADE;
CREATE TYPE order_type AS ENUM ('B2B', 'B2C');

DROP TYPE IF EXISTS payment_type CASCADE;
CREATE TYPE payment_type AS ENUM ('PREPAID', 'COD');

DROP TYPE IF EXISTS agent_status CASCADE;
CREATE TYPE agent_status AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

DROP TYPE IF EXISTS order_status CASCADE;
CREATE TYPE order_status AS ENUM (
  'CREATED',
  'ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RESCHEDULED'
);

DROP TYPE IF EXISTS surcharge_type CASCADE;
CREATE TYPE surcharge_type AS ENUM ('FLAT', 'PERCENTAGE');

-- 1. Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  role user_role NOT NULL DEFAULT 'CUSTOMER',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Zones Table (Coordinates Bounding Box + Polygon support)
CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  min_lat NUMERIC(10, 7),
  max_lat NUMERIC(10, 7),
  min_lng NUMERIC(10, 7),
  max_lng NUMERIC(10, 7),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Areas Table (Map pincode/area to Zone)
CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  pincode VARCHAR(20) NOT NULL UNIQUE,
  zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Rate Cards Table (Admin Configurable)
CREATE TABLE rate_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_type order_type NOT NULL,
  is_intra_zone BOOLEAN NOT NULL,
  base_fare NUMERIC(10, 2) NOT NULL DEFAULT 50.00 CHECK (base_fare >= 0),
  base_weight_kg NUMERIC(6, 2) NOT NULL DEFAULT 1.00 CHECK (base_weight_kg > 0),
  per_kg_rate NUMERIC(10, 2) NOT NULL DEFAULT 15.00 CHECK (per_kg_rate >= 0),
  min_charge NUMERIC(10, 2) NOT NULL DEFAULT 50.00 CHECK (min_charge >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_type, is_intra_zone)
);

-- 5. COD Surcharge Configs Table
CREATE TABLE surcharge_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_type order_type UNIQUE NOT NULL,
  surcharge_type surcharge_type NOT NULL DEFAULT 'FLAT',
  surcharge_value NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Delivery Agent Profiles Table
CREATE TABLE agent_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status agent_status NOT NULL DEFAULT 'OFFLINE',
  current_lat NUMERIC(10, 7),
  current_lng NUMERIC(10, 7),
  assigned_zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Orders Table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pickup_address TEXT NOT NULL,
  drop_address TEXT NOT NULL,
  pickup_lat NUMERIC(10, 7),
  pickup_lng NUMERIC(10, 7),
  drop_lat NUMERIC(10, 7),
  drop_lng NUMERIC(10, 7),
  pickup_zone_id UUID REFERENCES zones(id),
  drop_zone_id UUID REFERENCES zones(id),
  length_cm NUMERIC(8, 2) NOT NULL,
  width_cm NUMERIC(8, 2) NOT NULL,
  height_cm NUMERIC(8, 2) NOT NULL,
  actual_weight_kg NUMERIC(8, 2) NOT NULL,
  volumetric_weight_kg NUMERIC(8, 2) NOT NULL,
  chargeable_weight_kg NUMERIC(8, 2) NOT NULL,
  order_type order_type NOT NULL,
  payment_type payment_type NOT NULL,
  base_charge NUMERIC(10, 2) NOT NULL,
  weight_charge NUMERIC(10, 2) NOT NULL,
  cod_surcharge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_charge NUMERIC(10, 2) NOT NULL,
  status order_status NOT NULL DEFAULT 'CREATED',
  assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rescheduled_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_agent ON orders(assigned_agent_id);

-- 8. Immutable Order Status History
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  previous_status order_status,
  new_status order_status NOT NULL,
  changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role user_role NOT NULL,
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_history_order ON order_status_history(order_id);
