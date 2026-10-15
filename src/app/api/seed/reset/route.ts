import { NextRequest, NextResponse } from 'next/server';
import { resetDatabase } from '@/lib/db';
import { verifyProviderAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyProviderAuth(req);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized: Provider authentication required to reset demo data' },
        { status: auth.statusCode || 401 }
      );
    }

    resetDatabase();
    return NextResponse.json({
      success: true,
      message: 'Demo state successfully reset to default seeded records.',
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset demo state' },
      { status: 500 }
    );
  }
}
