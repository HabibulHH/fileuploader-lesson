# Assignment: File Upload API with NestJS

> Module 26 — POST API & Data Handling
> **Deadline:** ৭ দিন | **Difficulty:** Intermediate

---

## Overview

তুমি Express.js দিয়ে যে File Upload System বানিয়েছো, সেটাই এবার **NestJS** + **Database** দিয়ে বানাবে। এবার file upload করলে সেটার information database এ save হবে, এবং uploaded files list, search, delete করা যাবে।

---

## Tech Stack

| Tool | কেন |
|------|-----|
| NestJS | Structured, scalable backend framework |
| TypeScript | Type safety, better DX |
| Prisma | Database ORM (সহজে DB handle) |
| PostgreSQL | Relational database |
| Multer (`@nestjs/platform-express`) | File upload handling |
| AWS SDK / DigitalOcean Spaces | Cloud file storage |
| class-validator | DTO validation |
| class-transformer | Request data transformation |

---

## Database Schema

```
┌─────────────────────────────────────────┐
│              uploads                     │
├─────────────────────────────────────────┤
│ id           String    @id @default(uuid)│
│ originalName String                      │
│ fileName     String    @unique           │
│ mimeType     String                      │
│ size         Int                         │
│ url          String                      │
│ storageType  String    (local / cloud)   │
│ uploadedBy   String?   (IP address)      │
│ status       String    (pending/done/failed) │
│ createdAt    DateTime  @default(now())   │
│ updatedAt    DateTime  @updatedAt        │
└─────────────────────────────────────────┘
```

**Prisma Schema:**

```prisma
model Upload {
  id           String   @id @default(uuid())
  originalName String
  fileName     String   @unique
  mimeType     String
  size         Int
  url          String
  storageType  String   @default("local")
  uploadedBy   String?
  status       String   @default("pending")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

---

## Project Structure (তোমাকে বানাতে হবে)

```
src/
├── app.module.ts
├── main.ts
├── config/
│   └── spaces.config.ts          # S3/Spaces configuration
├── upload/
│   ├── upload.module.ts
│   ├── upload.controller.ts      # Routes/Endpoints
│   ├── upload.service.ts         # Business logic
│   ├── dto/
│   │   ├── upload-response.dto.ts
│   │   └── query-uploads.dto.ts  # Pagination/filter DTO
│   ├── guards/
│   │   └── rate-limit.guard.ts   # Rate limiting
│   ├── pipes/
│   │   └── file-validation.pipe.ts # File type + size validation
│   ├── interceptors/
│   │   └── upload-logging.interceptor.ts # Log every upload
│   └── interfaces/
│       └── upload-file.interface.ts
├── spaces/
│   ├── spaces.module.ts
│   ├── spaces.service.ts         # S3 upload logic
│   └── queue/
│       └── upload-queue.service.ts # Background upload queue
├── prisma/
│   ├── prisma.module.ts
│   ├── prisma.service.ts         # Database connection
│   └── schema.prisma
└── common/
    ├── filters/
    │   └── http-exception.filter.ts # Global error handler
    └── dto/
        └── pagination.dto.ts
```

---

## API Endpoints

### 1. `POST /upload/single` — একটা File Upload

**Request:**
```
Content-Type: multipart/form-data
Field: "file" (single file)
```

**কী করবে:**
1. Multer দিয়ে file receive করো
2. File type validate করো (pipe)
3. Rate limit check করো (guard)
4. Locally save করো
5. Database এ entry create করো (`status: "pending"`)
6. Background queue তে S3 upload task add করো
7. Response পাঠাও

**Response (201):**
```json
{
  "message": "File uploaded successfully",
  "data": {
    "id": "a1b2c3d4-...",
    "originalName": "photo.png",
    "fileName": "1771181619800-photo.png",
    "mimeType": "image/png",
    "size": 106610,
    "url": "/uploads/1771181619800-photo.png",
    "status": "pending",
    "createdAt": "2026-02-16T10:30:00.000Z"
  }
}
```

---

### 2. `POST /upload/multiple` — একাধিক File Upload (Max 5)

**Request:**
```
Content-Type: multipart/form-data
Field: "files" (array, max 5)
```

**Response (201):**
```json
{
  "message": "3 file(s) uploaded successfully",
  "data": [
    { "id": "...", "originalName": "a.png", "status": "pending" },
    { "id": "...", "originalName": "b.jpg", "status": "pending" },
    { "id": "...", "originalName": "c.webp", "status": "pending" }
  ]
}
```

---

### 3. `GET /upload` — সব Uploads দেখো (Pagination + Filter)

**Query Parameters:**

| Param | Type | Default | বর্ণনা |
|-------|------|---------|--------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Per page items |
| `status` | string | — | Filter: `pending`, `done`, `failed` |
| `mimeType` | string | — | Filter: `image/png`, `image/jpeg` |
| `search` | string | — | originalName এ search |
| `sortBy` | string | `createdAt` | Sort field |
| `order` | string | `desc` | `asc` or `desc` |

**Response (200):**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "originalName": "photo.png",
      "fileName": "1771181619800-photo.png",
      "mimeType": "image/png",
      "size": 106610,
      "url": "https://testbuckets.sgp1.digitaloceanspaces.com/1771181619800-photo.png",
      "status": "done",
      "createdAt": "2026-02-16T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

### 4. `GET /upload/:id` — একটা Upload এর Details

**Response (200):**
```json
{
  "data": {
    "id": "a1b2c3d4-...",
    "originalName": "photo.png",
    "fileName": "1771181619800-photo.png",
    "mimeType": "image/png",
    "size": 106610,
    "url": "https://testbuckets.sgp1.digitaloceanspaces.com/...",
    "storageType": "cloud",
    "uploadedBy": "127.0.0.1",
    "status": "done",
    "createdAt": "2026-02-16T10:30:00.000Z",
    "updatedAt": "2026-02-16T10:30:05.000Z"
  }
}
```

---

### 5. `DELETE /upload/:id` — File Delete করো

**কী করবে:**
1. Database থেকে record খুঁজো
2. S3/Cloud থেকে file delete করো (`DeleteObjectCommand`)
3. Local file থাকলে সেটাও delete করো
4. Database থেকে record delete করো

**Response (200):**
```json
{
  "message": "File deleted successfully",
  "data": {
    "id": "a1b2c3d4-...",
    "originalName": "photo.png"
  }
}
```

---

### 6. `GET /upload/stats` — Upload Statistics

**Response (200):**
```json
{
  "totalFiles": 45,
  "totalSize": 52428800,
  "totalSizeFormatted": "50 MB",
  "byStatus": {
    "done": 40,
    "pending": 3,
    "failed": 2
  },
  "byMimeType": {
    "image/png": 20,
    "image/jpeg": 18,
    "image/webp": 7
  }
}
```

---

## Error Responses

সব error একই format এ হবে (Global Exception Filter):

```json
{
  "statusCode": 400,
  "message": "Only image files are allowed (jpeg, png, webp)",
  "error": "Bad Request",
  "timestamp": "2026-02-16T10:30:00.000Z",
  "path": "/upload/single"
}
```

| Status | কখন |
|--------|------|
| `400` | Invalid file type, file too large, no file, validation fail |
| `404` | Upload ID not found |
| `429` | Rate limit exceeded |
| `500` | S3 error, database error |

---

## NestJS Concepts যেগুলো ব্যবহার করতে হবে

### 1. Module (`@Module`)
```typescript
@Module({
  imports: [PrismaModule, SpacesModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
```

### 2. Controller (`@Controller`) — Routes Define
```typescript
@Controller('upload')
export class UploadController {
  @Post('single')
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(RateLimitGuard)
  async uploadSingle(@UploadedFile(FileValidationPipe) file: Express.Multer.File) {
    return this.uploadService.handleSingleUpload(file);
  }

  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 5))
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) { ... }

  @Get()
  async findAll(@Query() query: QueryUploadsDto) { ... }

  @Get(':id')
  async findOne(@Param('id') id: string) { ... }

  @Delete(':id')
  async remove(@Param('id') id: string) { ... }
}
```

### 3. Service (`@Injectable`) — Business Logic
```typescript
@Injectable()
export class UploadService {
  constructor(
    private prisma: PrismaService,
    private spacesService: SpacesService,
    private uploadQueue: UploadQueueService,
  ) {}

  async handleSingleUpload(file: Express.Multer.File) {
    // 1. Database এ save
    // 2. Queue তে push
    // 3. Response return
  }
}
```

### 4. Pipe — Validation
```typescript
@Injectable()
export class FileValidationPipe implements PipeTransform {
  transform(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File too large (max 5MB)');
    }

    return file;
  }
}
```

### 5. Guard — Rate Limiting
```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  private requests = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip;
    // ... rate limit logic
    // false return করলে 403 Forbidden হবে
    // throw new ThrottleException() দিলে 429
  }
}
```

### 6. Interceptor — Logging
```typescript
@Injectable()
export class UploadLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const now = Date.now();
    return next.handle().pipe(
      tap(() => console.log(`Upload took ${Date.now() - now}ms`)),
    );
  }
}
```

### 7. Exception Filter — Global Error Handler
```typescript
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception.getStatus?.() || 500;

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

### 8. DTO — Data Transfer Object (class-validator)
```typescript
export class QueryUploadsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsIn(['pending', 'done', 'failed'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
```

---

## Express vs NestJS — তুমি কী শিখবে

| Express (আগে যা করেছো) | NestJS (এখন যা করবে) |
|--------------------------|----------------------|
| `app.use(middleware)` | `@UseGuards()`, `@UseInterceptors()`, `@UsePipes()` |
| Manual middleware function | `Guard`, `Pipe`, `Interceptor`, `Filter` classes |
| `req.file` from multer | `@UploadedFile()` decorator |
| `module.exports` | `@Module()` + dependency injection |
| Manual validation | `class-validator` + DTO |
| No structure | Module → Controller → Service pattern |
| Callback style | TypeScript + decorators |
| No database | Prisma ORM + PostgreSQL |

---

## Grading Rubric

### Required (মোট ৭০ নম্বর)

| Task | Points | বর্ণনা |
|------|--------|--------|
| Project Setup | 5 | NestJS + Prisma + PostgreSQL connected |
| Single Upload | 10 | `POST /upload/single` কাজ করে |
| Multiple Upload | 10 | `POST /upload/multiple` কাজ করে |
| Database Save | 10 | Upload info database এ save হচ্ছে |
| Cloud Upload | 10 | S3/Spaces এ file যাচ্ছে, status update হচ্ছে |
| List with Pagination | 10 | `GET /upload` pagination সহ কাজ করে |
| Delete | 10 | `DELETE /upload/:id` cloud + DB থেকে মুছছে |
| Error Handling | 5 | সব error proper format এ আসছে |

### Bonus (মোট ৩০ নম্বর)

| Task | Points | বর্ণনা |
|------|--------|--------|
| File Validation Pipe | 5 | Custom pipe দিয়ে type + size check |
| Rate Limit Guard | 5 | Custom guard দিয়ে rate limiting |
| Upload Logging Interceptor | 5 | প্রতিটা upload log হচ্ছে |
| Global Exception Filter | 5 | সব error consistent format |
| Stats Endpoint | 5 | `GET /upload/stats` কাজ করে |
| Search + Filter | 5 | name search, status/type filter কাজ করে |

---

## Setup Instructions

```bash
# 1. NestJS project তৈরি করো
npm i -g @nestjs/cli
nest new file-upload-api
cd file-upload-api

# 2. Dependencies install
npm install @nestjs/platform-express multer
npm install @prisma/client @aws-sdk/client-s3
npm install class-validator class-transformer
npm install fastq
npm install -D prisma @types/multer

# 3. Prisma setup
npx prisma init
# schema.prisma এ model লেখো (উপরে দেওয়া আছে)
# .env এ DATABASE_URL দাও

# 4. Database migrate
npx prisma migrate dev --name init

# 5. Run
npm run start:dev
```

---

## Submission

তোমাকে জমা দিতে হবে:
1. **GitHub Repository** — সব code push করো
2. **Postman Collection** — সব endpoint test করা export
3. **README.md** — setup instructions + screenshot
4. **`.env.example`** — variable names (values ছাড়া)

---

## Tips

- আগে Express এ যা করেছো সেটা ভালো করে বুঝে নাও, তাহলে NestJS এ convert করা সহজ হবে
- NestJS এর official docs পড়ো: https://docs.nestjs.com
- Prisma docs: https://www.prisma.io/docs
- একটা একটা endpoint বানাও, সব একসাথে বানাতে যেও না
- প্রথমে database ছাড়া কাজ করাও, তারপর database add করো
- Postman দিয়ে প্রতিটা endpoint test করো বানানোর সাথে সাথে
