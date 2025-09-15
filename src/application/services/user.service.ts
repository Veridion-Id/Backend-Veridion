import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../../infrastructure/firebase/firebase.adapter';
import { User, UserStatus, CreateUserDto, UpdateUserStatusDto } from '../../domain/entities/user.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly collectionName = 'users';

  constructor(private readonly firebaseService: FirebaseService) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const now = new Date();
      const userData: User = {
        ...createUserDto,
        status: UserStatus.PENDING,
        createdAt: now,
        updatedAt: now,
      };

      await this.firebaseService.getFirestore()
        .collection(this.collectionName)
        .doc(createUserDto.walletAddress)
        .set(userData);

      this.logger.log(`User created with wallet address: ${createUserDto.walletAddress}`);
      return userData;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
      throw error;
    }
  }

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    try {
      const doc = await this.firebaseService.getFirestore()
        .collection(this.collectionName)
        .doc(walletAddress)
        .get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() as User;
    } catch (error) {
      this.logger.error(`Failed to find user by wallet address ${walletAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
      throw error;
    }
  }


  async findAll(): Promise<User[]> {
    try {
      const snapshot = await this.firebaseService.getFirestore()
        .collection(this.collectionName)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => doc.data() as User);
    } catch (error) {
      this.logger.error(`Failed to find all users: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
      throw error;
    }
  }

  async updateStatus(walletAddress: string, updateUserStatusDto: UpdateUserStatusDto): Promise<User> {
    try {
      const updateData = {
        status: updateUserStatusDto.status,
        updatedAt: new Date(),
      };

      await this.firebaseService.getFirestore()
        .collection(this.collectionName)
        .doc(walletAddress)
        .update(updateData);

      this.logger.log(`User ${walletAddress} status updated to ${updateUserStatusDto.status}`);
      
      const updatedUser = await this.findByWalletAddress(walletAddress);
      if (!updatedUser) {
        throw new Error('User not found after update');
      }
      
      return updatedUser;
    } catch (error) {
      this.logger.error(`Failed to update user status for wallet address ${walletAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
      throw error;
    }
  }

  async delete(walletAddress: string): Promise<void> {
    try {
      await this.firebaseService.getFirestore()
        .collection(this.collectionName)
        .doc(walletAddress)
        .delete();

      this.logger.log(`User ${walletAddress} deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete user ${walletAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
      throw error;
    }
  }
}
