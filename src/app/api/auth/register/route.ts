import { NextResponse } from 'next/server';
import { db } from '@/server/data/db';
import {
  InvalidLocationError,
  resolveLocation,
  resolveSecurityQuestion,
  type ResolvedLocation,
} from '@/server/data/locations';
import * as bcrypt from 'bcryptjs';
import { normaliseSecurityAnswer } from '@/server/auth/securityAnswer';
import { consume, clientKey, rateLimitHeaders, LIMITS } from '@/server/http/rateLimit';

export async function POST(request: Request) {
  // Audit fix S-4: cap automated account creation.
  const limit = consume(clientKey(request, 'register'), LIMITS.register.limit, LIMITS.register.windowMs);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many registration attempts. Try again in ${limit.retryAfter} seconds.` },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      password,
      mobileNumber,
      country,
      state,
      city,
      securityQuestion,
      securityAnswer,
    } = body;

    // Basic Validation
    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !mobileNumber ||
      !country ||
      !state ||
      !city ||
      !securityQuestion ||
      !securityAnswer
    ) {
      return NextResponse.json(
        { error: 'All fields are mandatory.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    if (mobileNumber.length !== 10) {
      return NextResponse.json(
        { error: 'Mobile number must contain exactly 10 digits.' },
        { status: 400 }
      );
    }

    // Check duplicate email
    const existingUser = await db.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists.' },
        { status: 400 }
      );
    }

    // Find default status "Active"
    const activeStatus = await db.accountStatus.findFirst({
      where: { statusName: 'Active' },
    });

    if (!activeStatus) {
      return NextResponse.json(
        { error: 'Database status table is not seeded properly.' },
        { status: 500 }
      );
    }

    // Find default role "Regular User"
    const defaultRole = await db.role.findFirst({
      where: { roleName: 'Regular User' },
    });

    if (!defaultRole) {
      return NextResponse.json(
        { error: 'Database roles table is not seeded properly.' },
        { status: 500 }
      );
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Audit fix S-2: security answers are password-equivalent secrets and are
    // hashed, never stored in readable form.
    const hashedSecurityAnswer = await bcrypt.hash(normaliseSecurityAnswer(securityAnswer), 10);

    /*
     * Location and security-question lists are static (shared/locations.ts), so
     * the client sends names rather than database ids. These resolve the names
     * to rows — validating against the same static dataset first, then creating
     * the row on first use — so the User foreign keys still hold without
     * pre-seeding every city on earth.
     */
    let location: ResolvedLocation;
    let securityQuestionId: number;
    try {
      [location, securityQuestionId] = await Promise.all([
        resolveLocation(String(country), String(state), String(city)),
        resolveSecurityQuestion(String(securityQuestion)),
      ]);
    } catch (error) {
      if (error instanceof InvalidLocationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    // Create User
    const newUser = await db.user.create({
      data: {
        firstName,
        lastName,
        email: String(email).trim().toLowerCase(),
        password: hashedPassword,
        mobileNumber,
        countryId: location.countryId,
        stateId: location.stateId,
        cityId: location.cityId,
        statusId: activeStatus.statusId,
        roleId: defaultRole.roleId,
        securityQuestionId,
        securityAnswer: hashedSecurityAnswer,
      },
    });

    return NextResponse.json(
      {
        message: 'Registration completed successfully. Please login to continue.',
        userId: newUser.userId,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed due to a server error.' },
      { status: 500 }
    );
  }
}
