// prisma/seed.ts
// Dev seed script — creates realistic data for local development.
// Uses Better Auth's internal hashPassword (Argon2id) so passwords are properly hashed.
// Does NOT insert raw password strings. Run via: tsx prisma/seed.ts
import "dotenv/config";
import { PrismaClient, MemberType } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Dev-only password — documented as non-production (T-02-04 accept)
const DEV_PASSWORD = "Password123!";

// ── Helper: create a Better Auth user with hashed password ───────────────────
async function createAuthUser(opts: {
  email: string;
  name: string;
  role: "LIBRARIAN" | "MEMBER";
}): Promise<string> {
  const hashedPw = await hashPassword(DEV_PASSWORD);

  const user = await prisma.user.create({
    data: {
      email: opts.email,
      name: opts.name,
      emailVerified: true,
      role: opts.role,
    },
  });

  // Create the credential Account record exactly as Better Auth's signUpEmail does
  await prisma.account.create({
    data: {
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: hashedPw,
    },
  });

  return user.id;
}

async function main() {
  console.log("Seeding database...");

  // ── 1. LoanPolicy (D-15, D-16) ─────────────────────────────────────────────
  await prisma.loanPolicy.upsert({
    where: { memberType: MemberType.STUDENT },
    update: {},
    create: {
      memberType: MemberType.STUDENT,
      loanDays: 14,
      maxRenewals: 2,
      fineDailyRate: 0.25,
      maxUnpaidFineAmount: 10.0,
    },
  });
  console.log("  LoanPolicy STUDENT seeded");

  await prisma.loanPolicy.upsert({
    where: { memberType: MemberType.FACULTY },
    update: {},
    create: {
      memberType: MemberType.FACULTY,
      loanDays: 30,
      maxRenewals: 4,
      fineDailyRate: 0.25,
      maxUnpaidFineAmount: 20.0,
    },
  });
  console.log("  LoanPolicy FACULTY seeded");

  // ── 2. Librarian account ───────────────────────────────────────────────────
  const existingLibrarian = await prisma.user.findUnique({
    where: { email: "librarian@library.test" },
  });
  if (!existingLibrarian) {
    await createAuthUser({
      email: "librarian@library.test",
      name: "Library Admin",
      role: "LIBRARIAN",
    });
    console.log("  Librarian seeded");
  } else {
    console.log("  Librarian already exists, skipping");
  }

  // ── 3. Students (10) ───────────────────────────────────────────────────────
  for (let i = 1; i <= 10; i++) {
    const email = `student${i}@library.test`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const userId = await createAuthUser({
        email,
        name: `Student User ${i}`,
        role: "MEMBER",
      });
      await prisma.member.create({
        data: {
          userId,
          memberNumber: `STU-${String(i).padStart(4, "0")}`,
          memberType: MemberType.STUDENT,
        },
      });
    }
  }
  console.log("  10 students seeded");

  // ── 4. Faculty (5) ────────────────────────────────────────────────────────
  for (let i = 1; i <= 5; i++) {
    const email = `faculty${i}@library.test`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const userId = await createAuthUser({
        email,
        name: `Faculty Member ${i}`,
        role: "MEMBER",
      });
      await prisma.member.create({
        data: {
          userId,
          memberNumber: `FAC-${String(i).padStart(4, "0")}`,
          memberType: MemberType.FACULTY,
        },
      });
    }
  }
  console.log("  5 faculty seeded");

  // ── 5. Books (20) with copies ─────────────────────────────────────────────
  const BOOKS: Array<{
    isbn: string;
    title: string;
    author: string;
    genre: string;
    publisher: string;
    publishedYear: number;
    copies: number;
  }> = [
    { isbn: "9780132350884", title: "Clean Code", author: "Robert C. Martin", genre: "Programming", publisher: "Prentice Hall", publishedYear: 2008, copies: 3 },
    { isbn: "9780201633610", title: "Design Patterns", author: "Gang of Four", genre: "Programming", publisher: "Addison-Wesley", publishedYear: 1994, copies: 2 },
    { isbn: "9780596517748", title: "JavaScript: The Good Parts", author: "Douglas Crockford", genre: "Programming", publisher: "O'Reilly Media", publishedYear: 2008, copies: 2 },
    { isbn: "9781491950357", title: "You Don't Know JS", author: "Kyle Simpson", genre: "Programming", publisher: "O'Reilly Media", publishedYear: 2015, copies: 1 },
    { isbn: "9780134685991", title: "Effective Java", author: "Joshua Bloch", genre: "Programming", publisher: "Addison-Wesley", publishedYear: 2018, copies: 2 },
    { isbn: "9781491927557", title: "Learning React", author: "Alex Banks", genre: "Programming", publisher: "O'Reilly Media", publishedYear: 2020, copies: 3 },
    { isbn: "9780735619678", title: "Code Complete", author: "Steve McConnell", genre: "Programming", publisher: "Microsoft Press", publishedYear: 2004, copies: 2 },
    { isbn: "9780201485677", title: "The Pragmatic Programmer", author: "Andrew Hunt", genre: "Programming", publisher: "Addison-Wesley", publishedYear: 1999, copies: 1 },
    { isbn: "9780321125217", title: "Domain-Driven Design", author: "Eric Evans", genre: "Software Architecture", publisher: "Addison-Wesley", publishedYear: 2003, copies: 2 },
    { isbn: "9781491904244", title: "Python Data Science Handbook", author: "Jake VanderPlas", genre: "Data Science", publisher: "O'Reilly Media", publishedYear: 2016, copies: 2 },
    { isbn: "9780062316110", title: "The Innovators", author: "Walter Isaacson", genre: "History", publisher: "Simon & Schuster", publishedYear: 2014, copies: 1 },
    { isbn: "9780735224292", title: "Homo Deus", author: "Yuval Noah Harari", genre: "Non-Fiction", publisher: "Harper", publishedYear: 2017, copies: 2 },
    { isbn: "9780525559474", title: "The Courage to Be Disliked", author: "Ichiro Kishimi", genre: "Psychology", publisher: "Atria Books", publishedYear: 2013, copies: 1 },
    { isbn: "9780385737951", title: "The Maze Runner", author: "James Dashner", genre: "Fiction", publisher: "Delacorte Press", publishedYear: 2009, copies: 3 },
    { isbn: "9780307887894", title: "The Power of Habit", author: "Charles Duhigg", genre: "Self-Help", publisher: "Random House", publishedYear: 2012, copies: 2 },
    { isbn: "9780062457714", title: "Sapiens", author: "Yuval Noah Harari", genre: "History", publisher: "Harper", publishedYear: 2011, copies: 2 },
    { isbn: "9780525478812", title: "The Fault in Our Stars", author: "John Green", genre: "Fiction", publisher: "Dutton Books", publishedYear: 2012, copies: 3 },
    { isbn: "9780143127741", title: "Thinking, Fast and Slow", author: "Daniel Kahneman", genre: "Psychology", publisher: "Farrar, Straus and Giroux", publishedYear: 2011, copies: 2 },
    { isbn: "9780316346627", title: "The Martian", author: "Andy Weir", genre: "Science Fiction", publisher: "Crown Publishing", publishedYear: 2011, copies: 1 },
    { isbn: "9780062315007", title: "Brief Answers to the Big Questions", author: "Stephen Hawking", genre: "Science", publisher: "Bantam Books", publishedYear: 2018, copies: 2 },
  ];

  let copyCounter = 1;
  for (const book of BOOKS) {
    const existingBook = await prisma.book.findUnique({ where: { isbn: book.isbn } });
    if (!existingBook) {
      const author = await prisma.author.upsert({
        where: { name: book.author },
        update: {},
        create: { name: book.author },
      });

      const created = await prisma.book.create({
        data: {
          isbn: book.isbn,
          title: book.title,
          authorId: author.id,
          genre: book.genre,
          publisher: book.publisher,
          publishedYear: book.publishedYear,
          totalCopies: book.copies,
        },
      });

      for (let c = 0; c < book.copies; c++) {
        await prisma.bookCopy.create({
          data: {
            bookId: created.id,
            barcode: `BC-${String(copyCounter).padStart(6, "0")}`,
            status: "AVAILABLE",
          },
        });
        copyCounter++;
      }
    } else {
      // advance counter for existing books
      copyCounter += book.copies;
    }
  }
  console.log("  20 books seeded with copies");

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
