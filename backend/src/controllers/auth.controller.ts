import { Request, Response } from "express";
import jwt from "jsonwebtoken";

import { generateOtp } from "../utils/generateOtp";
import { prisma } from "../config/prisma";
import { sendOTPEmail } from "../services/email.service";
import { JWT_SECRET } from "../config/jwt";

export const sendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const otp = generateOtp();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.otpCode.deleteMany({
      where: {
        email,
      },
    });

    await prisma.otpCode.create({
      data: {
        email,
        otp,
        expiresAt,
      },
    });

    await sendOTPEmail(email, otp);

    return res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        email,
        otp,
      },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    let user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: email.split("@")[0],
        },
      });
    }

    await prisma.otpCode.deleteMany({
      where: {
        email,
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      JWT_SECRET,
      {
        expiresIn: "30d",
      },
    );

    return res.json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
