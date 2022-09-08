import { IsNumberString, IsString, Length, Matches } from 'class-validator';

export class AppDto {
  @IsString()
  @Length(44)
  // user wallet publickey
  userPublicKey: string;

  @IsString()
  @Length(44)
  // cross chain token address
  mint: string;

  @IsString()
  @Length(42)
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  // cross chain target recipient eth address
  targetAddress: string;

  @IsNumberString()
  // cross chain amount
  amount: string;
}
