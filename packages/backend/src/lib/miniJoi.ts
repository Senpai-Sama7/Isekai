type ValidationDetail = { message: string; path: string[] };

interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

export interface ValidationResult<T> {
  value: T;
  error?: { details: ValidationDetail[] };
}

abstract class Schema<T> {
  protected isRequired = false;

  required(): this {
    this.isRequired = true;
    return this;
  }

  optional(): this {
    this.isRequired = false;
    return this;
  }

  abstract validate(value: unknown, options?: ValidationOptions, path?: string[]): ValidationResult<T>;
}

class StringSchema extends Schema<string | undefined> {
  private minLength?: number;
  private maxLength?: number;

  min(length: number) {
    this.minLength = length;
    return this;
  }

  max(length: number) {
    this.maxLength = length;
    return this;
  }

  validate(value: unknown, _options: ValidationOptions = {}, path: string[] = []): ValidationResult<string | undefined> {
    const errors: ValidationDetail[] = [];

    if (value === undefined || value === null) {
      if (this.isRequired) {
        errors.push({ message: 'Value is required', path });
      }
      return { value, error: errors.length ? { details: errors } : undefined };
    }

    if (typeof value !== 'string') {
      errors.push({ message: 'Value must be a string', path });
      return { value: undefined, error: { details: errors } };
    }

    if (this.minLength !== undefined && value.length < this.minLength) {
      errors.push({ message: `Value must be at least ${this.minLength} characters`, path });
    }

    if (this.maxLength !== undefined && value.length > this.maxLength) {
      errors.push({ message: `Value must be at most ${this.maxLength} characters`, path });
    }

    return {
      value,
      error: errors.length ? { details: errors } : undefined,
    };
  }
}

class ObjectSchema extends Schema<Record<string, unknown>> {
  constructor(private shape: Record<string, Schema<any>> = {}) {
    super();
  }

  keys(shape: Record<string, Schema<any>>) {
    this.shape = shape;
    return this;
  }

  validate(value: unknown, options: ValidationOptions = {}, path: string[] = []): ValidationResult<Record<string, unknown>> {
    const errors: ValidationDetail[] = [];

    if (value === undefined || value === null) {
      if (this.isRequired) {
        errors.push({ message: 'Value is required', path });
        return { value: {}, error: { details: errors } };
      }

      return { value: undefined as unknown as Record<string, unknown> };
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      errors.push({ message: 'Value must be an object', path });
      return { value: {}, error: { details: errors } };
    }

    const input = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    const shapeEntries = Object.entries(this.shape);

    if (shapeEntries.length === 0) {
      const clone = options.stripUnknown ? { ...input } : input;
      return { value: clone, error: errors.length ? { details: errors } : undefined };
    }

    for (const [key, schema] of shapeEntries) {
      const result = schema.validate(input[key], options, [...path, key]);
      if (result.error) {
        errors.push(...result.error.details);
      } else if (result.value !== undefined) {
        sanitized[key] = result.value;
      }
    }

    if (!options.stripUnknown) {
      for (const [key, val] of Object.entries(input)) {
        if (!(key in this.shape)) {
          sanitized[key] = val;
        }
      }
    }

    return {
      value: sanitized,
      error: errors.length ? { details: errors } : undefined,
    };
  }
}

class AnySchema extends Schema<unknown> {
  validate(value: unknown, _options: ValidationOptions = {}, path: string[] = []): ValidationResult<unknown> {
    if ((value === undefined || value === null) && this.isRequired) {
      return { value: undefined, error: { details: [{ message: 'Value is required', path }] } };
    }

    return { value };
  }
}

export type JoiLikeObjectSchema = ObjectSchema & {
  validate(value: unknown, options?: ValidationOptions): ValidationResult<Record<string, unknown>>;
};

const MiniJoi = {
  string() {
    return new StringSchema();
  },
  object(shape: Record<string, Schema<any>> = {}) {
    return new ObjectSchema(shape);
  },
  any() {
    return new AnySchema();
  },
};

export default MiniJoi;
