const crypto = require("node:crypto");
const db = require("../config/db");
const AppError = require("../utils/AppError");
const HouseholdRepository = require("../repositories/HouseholdRepository");
const HouseholdMemberRepository = require("../repositories/HouseholdMemberRepository");
const HouseholdInviteRepository = require("../repositories/HouseholdInviteRepository");
const UserRepository = require("../repositories/UserRepository");
const EmailService = require("./EmailService");
const { householdInviteEmail, appUrl } = require("../mail/emailLayout");
const { buildDisplayName } = require("../helpers/personName");
const {
  HouseholdDto,
  HouseholdMemberDto,
  HouseholdInviteDto,
} = require("../dto/v1/householdDto");

const INVITE_TTL_DAYS = 7;
const ROLES = Object.freeze({ OWNER: "owner", MEMBER: "member" });

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function assertOwner(membership) {
  if (!membership || membership.role !== ROLES.OWNER) {
    throw new AppError("Apenas o dono da conta familiar pode fazer isso", 403);
  }
}

function assertMember(membership) {
  if (!membership) {
    throw new AppError("Você não faz parte desta conta familiar", 403);
  }
}

async function requireMembership(householdId, userId) {
  const membership = await HouseholdMemberRepository.findByHouseholdAndUser(
    householdId,
    userId,
  );
  assertMember(membership);
  return membership;
}

const HouseholdService = {
  ROLES,

  isOwnerRole(role) {
    return role === ROLES.OWNER;
  },

  isMemberRole(role) {
    return role === ROLES.MEMBER || role === ROLES.OWNER;
  },

  /**
   * Cria household e adiciona o usuário como owner.
   * Um usuário só pode ser dono de uma casa nesta versão.
   */
  async create(userId, { name } = {}) {
    const trimmed = String(name || "").trim();
    if (!trimmed) throw new AppError("Informe o nome da conta familiar", 422);

    const existingOwned = await HouseholdRepository.findOwnedByUser(userId);
    if (existingOwned) {
      throw new AppError("Você já é dono de uma conta familiar", 409);
    }

    const alreadyIn = await HouseholdRepository.findForUser(userId);
    if (alreadyIn) {
      throw new AppError("Você já faz parte de uma conta familiar", 409);
    }

    const household = await db.withTransaction(async (client) => {
      const created = await HouseholdRepository.create(
        { name: trimmed, ownerUserId: userId },
        client,
      );
      await HouseholdMemberRepository.create(
        { householdId: created.id, userId, role: ROLES.OWNER },
        client,
      );
      return created;
    });

    return { household: HouseholdDto(household) };
  },

  async getMine(userId) {
    const household = await HouseholdRepository.findForUser(userId);
    if (!household) return { household: null, membership: null };

    const membership = await HouseholdMemberRepository.findByHouseholdAndUser(
      household.id,
      userId,
    );
    return {
      household: HouseholdDto(household),
      membership: membership ? HouseholdMemberDto(membership) : null,
    };
  },

  async listMembers(userId, householdId) {
    await requireMembership(householdId, userId);
    const rows = await HouseholdMemberRepository.listByHousehold(householdId);
    return { members: rows.map(HouseholdMemberDto) };
  },

  /**
   * Convida por e-mail (somente owner).
   * Duplicata: convite aberto para o mesmo e-mail → 409.
   */
  async invite(userId, householdId, { email } = {}) {
    const membership = await requireMembership(householdId, userId);
    assertOwner(membership);

    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes("@")) {
      throw new AppError("Informe um e-mail válido", 422);
    }

    const household = await HouseholdRepository.findById(householdId);
    if (!household) throw new AppError("Conta familiar não encontrada", 404);

    const inviter = await UserRepository.findById(userId);
    if (normalizeEmail(inviter?.email) === normalized) {
      throw new AppError("Você não pode convidar a si mesmo", 422);
    }

    const existingUser = await UserRepository.findByEmail(normalized);
    if (existingUser) {
      const alreadyMember = await HouseholdMemberRepository.findByHouseholdAndUser(
        householdId,
        existingUser.id,
      );
      if (alreadyMember) {
        throw new AppError("Este usuário já faz parte da conta familiar", 409);
      }
    }

    const openInvite = await HouseholdInviteRepository.findOpenByHouseholdAndEmail(
      householdId,
      normalized,
    );
    if (openInvite) {
      if (new Date(openInvite.expires_at) > new Date()) {
        throw new AppError("Já existe um convite pendente para este e-mail", 409);
      }
      // expirado: revoga e permite novo
      await HouseholdInviteRepository.revokeOpenByHouseholdAndEmail(
        householdId,
        normalized,
      );
    }

    const raw = generateToken();
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invite = await HouseholdInviteRepository.create({
      householdId,
      email: normalized,
      invitedByUserId: userId,
      tokenHash,
      role: ROLES.MEMBER,
      expiresAt,
    });

    const inviteUrl = appUrl(
      `/conta-familiar/convite?token=${encodeURIComponent(raw)}`,
    );
    const mail = householdInviteEmail({
      inviteeFirstName: existingUser?.first_name || null,
      inviterName: buildDisplayName(inviter) || inviter?.first_name || "Alguém",
      householdName: household.name,
      inviteUrl,
      ttlDays: INVITE_TTL_DAYS,
    });
    await EmailService.send({ to: normalized, ...mail });

    return {
      invite: HouseholdInviteDto(invite),
      // token raw só aqui (dev/testes); e-mail carrega o link
      token: raw,
    };
  },

  /**
   * Aceita convite com token. Usuário autenticado deve bater o e-mail do convite.
   */
  async acceptInvite(userId, { token } = {}) {
    if (!token || typeof token !== "string" || token.length < 8) {
      throw new AppError("Token de convite inválido", 404);
    }

    const tokenHash = hashToken(token);
    const byHash = await HouseholdInviteRepository.findByHash(tokenHash);
    if (!byHash) throw new AppError("Convite não encontrado", 404);
    if (byHash.accepted_at) throw new AppError("Convite já foi aceito", 409);
    if (byHash.revoked_at) throw new AppError("Convite foi revogado", 410);
    if (new Date(byHash.expires_at) <= new Date()) {
      throw new AppError("Convite expirado", 410);
    }

    const invite = await HouseholdInviteRepository.findValidByHash(tokenHash);
    if (!invite) throw new AppError("Convite inválido ou expirado", 404);

    const user = await UserRepository.findById(userId);
    if (!user) throw new AppError("Usuário não encontrado", 404);
    if (normalizeEmail(user.email) !== normalizeEmail(invite.email)) {
      throw new AppError("Este convite foi enviado para outro e-mail", 403);
    }

    const alreadyIn = await HouseholdRepository.findForUser(userId);
    if (alreadyIn) {
      throw new AppError("Você já faz parte de uma conta familiar", 409);
    }

    const alreadyMember = await HouseholdMemberRepository.findByHouseholdAndUser(
      invite.household_id,
      userId,
    );
    if (alreadyMember) {
      await HouseholdInviteRepository.markAccepted(invite.id);
      throw new AppError("Você já faz parte desta conta familiar", 409);
    }

    await db.withTransaction(async (client) => {
      await HouseholdMemberRepository.create(
        {
          householdId: invite.household_id,
          userId,
          role: invite.role || ROLES.MEMBER,
        },
        client,
      );
      await HouseholdInviteRepository.markAccepted(invite.id, client);
    });

    const household = await HouseholdRepository.findById(invite.household_id);
    const membership = await HouseholdMemberRepository.findByHouseholdAndUser(
      invite.household_id,
      userId,
    );

    return {
      household: HouseholdDto(household),
      membership: HouseholdMemberDto(membership),
    };
  },

  /**
   * Remove membro (somente owner). Não remove o próprio owner.
   */
  async removeMember(actorUserId, householdId, targetUserId) {
    const actor = await requireMembership(householdId, actorUserId);
    assertOwner(actor);

    if (actorUserId === targetUserId) {
      throw new AppError("O dono não pode remover a si mesmo", 422);
    }

    const target = await HouseholdMemberRepository.findByHouseholdAndUser(
      householdId,
      targetUserId,
    );
    if (!target) throw new AppError("Membro não encontrado", 404);
    if (target.role === ROLES.OWNER) {
      throw new AppError("Não é possível remover o dono da conta familiar", 422);
    }

    await HouseholdMemberRepository.remove(householdId, targetUserId);
    return { removed: true, userId: targetUserId };
  },
};

module.exports = HouseholdService;
