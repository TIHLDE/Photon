import { schema } from "@photon/db";
import { type SQL, getTableName, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

const settings = sql.identifier(getTableName(schema.userSettings));
const settingsImage = sql.identifier(schema.userSettings.imageUrl.name);
const settingsUser = sql.identifier(schema.userSettings.userId.name);

// Opplastet avatar ligger i user_settings, mens auth_user.image er den fra
// Feide og Lepton-importen — så den opplastede må vinne overalt, ikke bare på
// profilsiden. Identifikatorene er rå fordi relasjonsspørringer skriver om
// hver kolonne i en `extras` til sitt eget tabellalias.
export function userImage(user: {
    id: AnyPgColumn;
    image: AnyPgColumn;
}): SQL<string | null> {
    return sql<
        string | null
    >`coalesce((select nullif(avatar_settings.${settingsImage}, '') from ${settings} avatar_settings where avatar_settings.${settingsUser} = ${user.id}), ${user.image})`;
}

export const userImageExtra = (user: {
    id: AnyPgColumn;
    image: AnyPgColumn;
}) => ({ image: userImage(user).as("image") });
