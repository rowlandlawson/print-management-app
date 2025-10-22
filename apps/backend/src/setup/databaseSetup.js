import { pool } from '../config/database.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
  try {
    console.log('🚀 Setting up database tables...');

    // Users table with worker payment info
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        user_name VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) CHECK (role IN ('admin', 'worker')) NOT NULL DEFAULT 'worker',
        is_active BOOLEAN DEFAULT true,
        
        -- Worker payment information (only for workers)
        hourly_rate DECIMAL(10,2),
        monthly_salary DECIMAL(10,2),
        payment_method VARCHAR(50),
        bank_name VARCHAR(100),
        account_number VARCHAR(50),
        account_name VARCHAR(250),
        
        -- Personal information
        phone VARCHAR(50),
        address TEXT,
        date_joined DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Password reset tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON password_reset_tokens(user_id);
    `);

    // Customers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        total_jobs_count INTEGER DEFAULT 0,
        total_amount_spent DECIMAL(15,2) DEFAULT 0,
        first_interaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_interaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL;
    `);

    // Jobs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        ticket_id VARCHAR(100) UNIQUE NOT NULL,
        customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
        worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        status VARCHAR(50) CHECK (status IN ('not_started', 'in_progress', 'completed', 'delivered')) DEFAULT 'not_started',
        total_cost DECIMAL(15,2) NOT NULL,
        amount_paid DECIMAL(15,2) DEFAULT 0,
        balance DECIMAL(15,2) DEFAULT 0,
        payment_status VARCHAR(50) CHECK (payment_status IN ('pending', 'partially_paid', 'fully_paid')) DEFAULT 'pending',
        mode_of_payment VARCHAR(50) CHECK (mode_of_payment IN ('cash', 'transfer', 'pos')),
        date_requested DATE NOT NULL,
        delivery_deadline DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Payments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        payment_type VARCHAR(50) CHECK (payment_type IN ('deposit', 'installment', 'full_payment', 'balance')) NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        recorded_by VARCHAR(255) NOT NULL,
        recorded_by_id UUID REFERENCES users(id) ON DELETE CASCADE,
        payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'transfer', 'pos')) NOT NULL,
        receipt_number VARCHAR(100) UNIQUE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Materials used table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS materials_used (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
        material_name VARCHAR(255) NOT NULL,
        paper_size VARCHAR(50),
        paper_type VARCHAR(100),
        grammage INTEGER,
        quantity INTEGER NOT NULL,
        unit_cost DECIMAL(15,2) NOT NULL,
        total_cost DECIMAL(15,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Waste and expenses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS waste_expenses (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
        type VARCHAR(50) CHECK (type IN ('paper_waste', 'material_waste', 'labor', 'operational', 'other')) NOT NULL,
        description TEXT NOT NULL,
        quantity INTEGER,
        unit_cost DECIMAL(15,2),
        total_cost DECIMAL(15,2) NOT NULL,
        waste_reason VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Inventory table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        material_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        paper_size VARCHAR(50),
        paper_type VARCHAR(100),
        grammage INTEGER,
        supplier VARCHAR(255),
        current_stock DECIMAL(15,2) NOT NULL,
        unit_of_measure VARCHAR(50) NOT NULL,
        unit_cost DECIMAL(15,2) NOT NULL,
        selling_price DECIMAL(15,2),
        threshold DECIMAL(15,2) NOT NULL,
        reorder_quantity DECIMAL(15,2),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Operational expenses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS operational_expenses (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        description TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        expense_date DATE NOT NULL,
        recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
        receipt_number VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Notifications table
    // Update notifications table for push notifications
await pool.query(`
  CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) CHECK (type IN ('new_job', 'payment_update', 'status_change', 'low_stock', 'system', 'alert')) NOT NULL,
    related_entity_type VARCHAR(50) CHECK (related_entity_type IN ('job', 'payment', 'inventory', 'customer', 'user')),
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT false,
    priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    action_url VARCHAR(500),
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
  CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
`);

// Push subscriptions table for PWA
await pool.query(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
  CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
`);

        // =========================
    // 🔁 Schema Updates / Alterations
    // =========================

    // 1️⃣ Add profit & cost breakdown columns to jobs table
    await pool.query(`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS materials_cost DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS waste_cost DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS operational_cost DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS labor_cost DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS profit DECIMAL(15,2) DEFAULT 0;
    `);

    // 2️⃣ Link materials_used to inventory
    await pool.query(`
      ALTER TABLE materials_used
      ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES inventory(id) ON DELETE SET NULL;
    `);

    // 3️⃣ Make job_id optional in waste_expenses (to allow general waste)
    await pool.query(`
      ALTER TABLE waste_expenses
      ALTER COLUMN job_id DROP NOT NULL;
    `);

    


    console.log('✅ Database tables created successfully!');
    
    // Create default admin user
    await createDefaultAdmin();
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function createDefaultAdmin() {
  const hashedPassword = await bcrypt.hash('admin!123', 12);
  
  try {
    await pool.query(`
      INSERT INTO users (email, name, password_hash, role) 
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, ['admin@printpress.com', 'System Administrator', hashedPassword, 'admin']);
    
    console.log(' Default admin user created: admin@printpress.com / admin!123');
    console.log(' Please change the default password after first login!');
  } catch (error) {
    console.log(' Admin user already exists or could not be created');
  }
}

setupDatabase();