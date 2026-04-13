Package for migrating from Lepton to Photon


1. Run docker compose to setup lepton-compatible database
2. Apply db dump on it
3. `bun run migrate` -> migrates to photon db (must be running) and verifies all data is in (count records match each table)