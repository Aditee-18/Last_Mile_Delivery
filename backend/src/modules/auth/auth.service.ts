import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../config/database';
import { UserRole } from '../../types/order.enums';

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export interface CreateAgentDTO {
  name: string;
  email: string;
  password: string;
  phone: string;
  assignedZoneId?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export class AuthService {
  private static JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_2026';
  private static JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

  public static async registerCustomer(dto: RegisterDTO) {
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [dto.email]);
    if (existingUser.rows.length > 0) {
      throw new Error('Email address is already registered.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, role, created_at`,
      [dto.name, dto.email, passwordHash, dto.phone, UserRole.CUSTOMER]
    );

    const user = result.rows[0];
    const token = this.generateToken(user.id, user.email, user.role);

    return { user, token };
  }

  public static async createAgentByAdmin(dto: CreateAgentDTO) {
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [dto.email]);
    if (existingUser.rows.length > 0) {
      throw new Error('Email address is already registered.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    await query('BEGIN');
    try {
      const userRes = await query(
        `INSERT INTO users (name, email, password_hash, phone, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, phone, role, created_at`,
        [dto.name, dto.email, passwordHash, dto.phone, UserRole.DELIVERY_AGENT]
      );

      const agentUser = userRes.rows[0];

      await query(
        `INSERT INTO agent_profiles (user_id, status, assigned_zone_id)
         VALUES ($1, 'AVAILABLE', $2)`,
        [agentUser.id, dto.assignedZoneId || null]
      );

      await query('COMMIT');
      return agentUser;
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  }

  public static async login(dto: LoginDTO) {
    const res = await query(
      'SELECT id, name, email, password_hash, phone, role, created_at FROM users WHERE email = $1',
      [dto.email]
    );

    if (res.rows.length === 0) {
      throw new Error('Invalid email or password.');
    }

    const user = res.rows[0];
    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('Invalid email or password.');
    }

    const token = this.generateToken(user.id, user.email, user.role);

    const { password_hash, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  public static async getUserById(userId: string) {
    const res = await query(
      'SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  public static generateToken(userId: string, email: string, role: UserRole): string {
    return jwt.sign({ userId, email, role }, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN as any,
    });
  }
}
