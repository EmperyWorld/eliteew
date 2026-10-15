import bcrypt from 'bcryptjs'
import { Request, Response, Router } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../index.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'

const router = Router()

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new AppError('JWT secret is not configured', 500)
  }
  return secret
}

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone } = req.body

    if (!email || !password || !name) {
      throw new AppError('Email, password and name are required', 400)
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      throw new AppError('User already exists', 400)
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      }
    })

    const secret = getJwtSecret()
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' })

    res.status(201).json({ user, token })
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('Registration failed', 500)
  }
})

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' })
    }

    const secret = getJwtSecret()
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' })

    res.cookie('site_auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    })

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
      },
      token
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ success: false, message: 'Login failed' })
  }
})

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatar: true,
        createdAt: true,
      }
    })

    if (!user) {
      throw new AppError('User not found', 404)
    }

    res.json(user)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('Failed to get user', 500)
  }
})

// Update profile
router.patch('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, avatar } = req.body

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name, phone, avatar },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatar: true,
      }
    })

    res.json(user)
  } catch (error) {
    throw new AppError('Failed to update profile', 500)
  }
})

// Change password
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    })

    res.json({ message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    return res.status(500).json({ success: false, message: 'Failed to change password' })
  }
})

export default router
