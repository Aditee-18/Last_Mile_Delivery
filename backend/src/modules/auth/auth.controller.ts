import { Request, Response } from 'express';
import { AuthService } from './auth.service';

export class AuthController {
  public static async register(req: Request, res: Response): Promise<void> {
    try {
      const { user, token } = await AuthService.registerCustomer(req.body);
      res.status(201).json({
        success: true,
        message: 'Account created successfully as Customer.',
        data: { user, token },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const { user, token } = await AuthService.login(req.body);
      res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: { user, token },
      });
    } catch (err: any) {
      res.status(401).json({ success: false, error: err.message });
    }
  }

  public static async getMe(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const user = await AuthService.getUserById(userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found.' });
        return;
      }
      res.status(200).json({ success: true, data: user });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
