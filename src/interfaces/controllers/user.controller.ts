import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, UsePipes } from '@nestjs/common';
import { UserService } from '../../application/services/user.service';
import { User, CreateUserDto, UpdateUserStatusDto } from '../../domain/entities/user.entity';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createUser(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.userService.create(createUserDto);
  }

  @Get()
  async getAllUsers(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get(':walletAddress')
  async getUserByWallet(@Param('walletAddress') walletAddress: string): Promise<User> {
    const user = await this.userService.findByWalletAddress(walletAddress);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  @Put(':walletAddress/status')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateUserStatus(
    @Param('walletAddress') walletAddress: string,
    @Body() updateUserStatusDto: UpdateUserStatusDto,
  ): Promise<User> {
    return this.userService.updateStatus(walletAddress, updateUserStatusDto);
  }

  @Delete(':walletAddress')
  async deleteUser(@Param('walletAddress') walletAddress: string): Promise<{ message: string }> {
    await this.userService.delete(walletAddress);
    return { message: 'User deleted successfully' };
  }
}
