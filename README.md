# Module 26 - POST API & Data Handling

## এই Module এ আপনি যা শিখবেন

আমরা যখন কোনো web application ব্যবহার করি — profile picture update করি, document submit করি — তখন browser থেকে server এ file transfer হয়। কিন্তু এই transfer টা কিভাবে কাজ করে? HTTP protocol তো মূলত text-based, তাহলে binary file কিভাবে যায়? Server side এ সেই file কিভাবে receive, validate, এবং store হয়?

এই module এ আমরা এই সম্পূর্ণ pipeline টা build করবো — **Express.js, Multer, এবং S3-compatible cloud storage** ব্যবহার করে একটা production-grade File Upload API তৈরি করবো।

---

## Module Overview: 3 Lessons

### Lesson 1: Form Submission and File Upload Handling

HTTP POST request এ file upload এর সম্পূর্ণ lifecycle — client-side encoding থেকে cloud storage পর্যন্ত।

**Topics:**
- **FormData API** — browser কিভাবে file কে multipart format এ encode করে
- **multipart/form-data encoding** — boundary-based content separation, Content-Disposition headers
- **MIME Type detection** — file type identification (`image/png`, `application/pdf`), MIME vs extension পার্থক্য
- **Binary data handling** — Blob (client-side), Buffer (Node.js), ArrayBuffer, Uint8Array
- **Multer middleware** — diskStorage vs memoryStorage, fileFilter, limits configuration, `req.file` object structure
- **S3-compatible cloud storage** — DigitalOcean Spaces integration, `PutObjectCommand`, ACL, public URL generation
- **Async task queue** — `fastq` দিয়ে background upload processing, concurrency control, local file cleanup

> Lesson শেষে আপনি single ও multiple file upload API তৈরি করতে পারবেন যেটা locally receive করে asynchronously cloud এ upload করে।

---

### Lesson 2: Error Handling in POST APIs

File upload process এর প্রতিটা stage এ কী কী error হতে পারে এবং সেগুলো কিভাবে gracefully handle করতে হয়।

**Topics:**
- **HTTP status codes** — 400 (Bad Request), 404 (Not Found), 429 (Too Many Requests), 500 (Internal Server Error) — কখন কোনটা ব্যবহার করবেন
- **Multer error handling** — `MulterError` class, `LIMIT_FILE_SIZE`, `LIMIT_FILE_COUNT`, `LIMIT_UNEXPECTED_FILE`
- **File validation strategy** — extension validation (`path.extname()`), MIME type validation, dual-layer security approach
- **Error middleware pattern** — Express এর 4-parameter `(err, req, res, next)` error handler
- **Async error handling** — try-catch blocks, S3 upload failures, file system errors, queue error propagation
- **Consistent error response format** — structured JSON error responses

> Lesson শেষে আপনার API এর প্রতিটা failure point handle করা থাকবে — কোনো unhandled exception থাকবে না।

---

### Lesson 3: POST API Security Best Practices

Production environment এ API কে abuse ও malicious usage থেকে protect করার techniques।

**Topics:**
- **Rate limiting** — `express-rate-limit` দিয়ে per-IP request throttling, `windowMs`, `max` configuration
- **Duplicate upload prevention** — `Map` data structure দিয়ে composite key tracking (`ip:filename`), TTL-based expiry, garbage collection pattern
- **File type restriction** — whitelist approach, `Set` data structure দিয়ে O(1) lookup, extension + MIME type dual validation
- **File size limiting** — `limits.fileSize` configuration, byte calculation (`5 * 1024 * 1024`)
- **Environment variables** — `dotenv` দিয়ে secrets management, `.env` file structure, `.gitignore` best practices
- **Middleware execution order** — security middleware chain design, কোন middleware আগে আসবে এবং কেন

> Lesson শেষে আপনার API rate-limited, validated, এবং production-ready হবে।

---

## Learning Outcomes

এই module সম্পূর্ণ করার পর আপনি —

- HTTP multipart/form-data encoding এর internal mechanism ব্যাখ্যা করতে পারবেন
- Express.js + Multer দিয়ে single ও multiple file upload endpoint implement করতে পারবেন
- S3-compatible cloud storage (DigitalOcean Spaces/AWS S3) এ programmatically file upload করতে পারবেন
- Async task queue implement করে non-blocking upload pipeline design করতে পারবেন
- File validation, rate limiting, এবং duplicate prevention এর মতো security layers implement করতে পারবেন
- Production-grade error handling pattern apply করতে পারবেন

---

## Prerequisites

- JavaScript fundamentals — functions, arrays, objects, async/await, Promises
- Express.js — routing, middleware concept (Module 25)
- API testing tool — Postman বা Thunder Client
- npm package management

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Express.js v5 | Web framework, routing, middleware pipeline |
| Multer v2 | multipart/form-data parsing, file storage |
| @aws-sdk/client-s3 | S3-compatible cloud storage operations |
| DigitalOcean Spaces | Cloud object storage (S3 API compatible) |
| fastq | Promise-based async task queue |
| express-rate-limit | IP-based request rate limiting |
| dotenv | Environment variable management |

---

## Assignment

Module শেষে একটা hands-on assignment আছে — **NestJS + PostgreSQL + Prisma** দিয়ে এই same file upload system rebuild করতে হবে। সেখানে upload metadata database এ persist হবে, pagination, search, filter, এবং delete functionality থাকবে। বিস্তারিত Module শেষে দেওয়া হবে।
