import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      password,
      mobileNumber,
      countryId,
      stateId,
      cityId,
      securityQuestionId,
      securityAnswer,
    } = body;

    // Basic Validation
    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !mobileNumber ||
      !countryId ||
      !stateId ||
      !cityId ||
      !securityQuestionId ||
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
      where: { email },
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

    // Create User
    const newUser = await db.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        mobileNumber,
        countryId: Number(countryId),
        stateId: Number(stateId),
        cityId: Number(cityId),
        statusId: activeStatus.statusId,
        roleId: defaultRole.roleId,
        securityQuestionId: Number(securityQuestionId),
        securityAnswer: securityAnswer.trim().toLowerCase(), // normalize answer
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
