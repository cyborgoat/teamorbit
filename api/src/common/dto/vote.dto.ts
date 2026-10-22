import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';

export class VoteDto {
  @ApiProperty({
    description: '1 = upvote, -1 = downvote, 0 = clear vote',
    enum: [1, -1, 0],
  })
  @Type(() => Number)
  @IsInt()
  @IsIn([1, -1, 0])
  value: 1 | -1 | 0;
}

export class VoteResultDto {
  @ApiProperty()
  score: number;

  @ApiProperty({ enum: [1, -1, 0] })
  myVote: number;
}
