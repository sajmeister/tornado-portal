import { NextResponse } from 'next/server';
import { fnGetAllRoles, fnGetRolePermissions, fnGetRoleDisplayName, fnGetRoleDescription } from '../../../src/lib/roles';

export async function GET() {
  try {
    const arrRoles = fnGetAllRoles();
    
    const arrRoleData = arrRoles.map(objRole => ({
      strRole: objRole.strRole,
      strDisplayName: objRole.strDisplayName,
      strDescription: objRole.strDescription,
      arrPermissions: objRole.arrPermissions
    }));

    return NextResponse.json({
      success: true,
      message: 'Roles retrieved successfully',
      data: arrRoleData
    });

  } catch (error) {
    console.error('Get roles error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
} 