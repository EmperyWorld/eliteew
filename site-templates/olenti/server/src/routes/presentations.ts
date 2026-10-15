import { Request, Response, Router } from 'express';
import { prisma } from '../index.js';
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { asString } from '../utils/params.js';

const router = Router();

// Get all presentations
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      search,
      isPublished,
      limit = '50',
      offset = '0',
      sort = 'createdAt',
      order = 'desc',
    } = req.query;

    const where: any = {};

    if (isPublished === 'true') where.isPublished = true;
    if (isPublished === 'false') where.isPublished = false;

    const searchTerm = search?.toString().trim();
    if (searchTerm) {
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { slug: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [presentations, total] = await Promise.all([
      prisma.presentation.findMany({
        where,
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        orderBy: { [sort as string]: order },
      }),
      prisma.presentation.count({ where }),
    ]);

    res.json({
      data: presentations,
      total,
      page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
      limit: parseInt(limit as string),
    });
  } catch (error) {
    console.error('Presentations error:', error);
    throw new AppError('Failed to fetch presentations', 500);
  }
});

// Get single presentation
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = asString(req.params.id);

    const presentation = await prisma.presentation.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    });

    if (!presentation) {
      throw new AppError('Presentation not found', 404);
    }

    res.json(presentation);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch presentation', 500);
  }
});

// Create presentation (admin)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, format = 'classic', slides = [], theme = null } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);

    // Ensure unique slug
    let finalSlug = slug;
    let counter = 1;
    while (await prisma.presentation.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    const presentation = await prisma.presentation.create({
      data: {
        title,
        slug: finalSlug,
        format,
        slides: slides || [],
        theme: theme || null,
        isPublished: false,
      },
    });

    res.status(201).json(presentation);
  } catch (error) {
    console.error('Create presentation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create presentation' });
  }
});

// Update presentation (admin)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id);
    const { title, format, slides, theme, isPublished } = req.body;

    const updateData: any = {};
    if (title !== undefined) {
      updateData.title = title;
      // Regenerate slug if title changed
      const slug = title
        .toLowerCase()
        .replace(/[^a-zа-яё0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100);

      // Ensure unique slug
      let finalSlug = slug;
      let counter = 1;
      while (
        await prisma.presentation.findFirst({
          where: {
            slug: finalSlug,
            NOT: { id },
          },
        })
      ) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }
      updateData.slug = finalSlug;
    }
    if (format !== undefined) updateData.format = format;
    if (slides !== undefined) updateData.slides = slides;
    if (theme !== undefined) updateData.theme = theme;
    if (isPublished !== undefined) updateData.isPublished = isPublished;

    const presentation = await prisma.presentation.update({
      where: { id },
      data: updateData,
    });

    res.json(presentation);
  } catch (error) {
    console.error('Update presentation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update presentation' });
  }
});

// Delete presentation (admin)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id);

    await prisma.presentation.delete({ where: { id } });

    res.json({ message: 'Presentation deleted' });
  } catch (error) {
    console.error('Delete presentation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete presentation' });
  }
});

export default router;
