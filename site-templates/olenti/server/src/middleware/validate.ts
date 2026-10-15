import { NextFunction, Request, Response } from 'express';

type SchemaWithParse = { parse: (data: unknown) => unknown };

export const validate = (schema: SchemaWithParse) => (req: Request, res: Response, next: NextFunction) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.errors,
    });
  }
};
