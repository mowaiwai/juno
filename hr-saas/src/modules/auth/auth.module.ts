import { Body, Controller, Module, Post, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { IsString } from 'class-validator';
import { PrismaService } from '../../common/prisma.service';

class LoginDto {
  @IsString()
  employee_no: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const emp = await this.prisma.org_employee.findFirst({
      where: { employee_no: dto.employee_no, is_deleted: 0 },
    });
    if (!emp) throw new UnauthorizedException('工号不存在');
    const token = await this.jwt.signAsync({
      sub: emp.id, tenant_id: emp.tenant_id, role: emp.role, dept_id: emp.dept_id,
    });
    return { token, employee: { id: emp.id, name: emp.name, role: emp.role, grade: emp.grade } };
  }
}

@Module({
  imports: [JwtModule.register({ global: true, secret: process.env.JWT_SECRET ?? 'dev-secret-change-me', signOptions: { expiresIn: '12h' } })],
  controllers: [AuthController],
  providers: [PrismaService],
})
export class AuthModule {}
