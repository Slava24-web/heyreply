import type { UserDto } from '@heyreply/shared';
import type { User } from '../generated/prisma/client';

export function toUserDto(u: User): UserDto {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    locale: u.locale,
    theme: u.theme,
    defaultCurrency: u.defaultCurrency,
    defaultSalaryType: u.defaultSalaryType,
    ghostingDays: u.ghostingDays,
    createdAt: u.createdAt.toISOString(),
  };
}
