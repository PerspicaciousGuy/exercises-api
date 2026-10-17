import { parseSupabaseScriptEnv } from '../config/supabaseEnv.js';
import { SupabaseRestClient } from '../supabase/restClient.js';
import { CATALOG_ENUM_VALUES } from '../constants/catalogEnums.js';

export { CATALOG_ENUM_VALUES };

export function createDefaultReferenceRepository() {
  const env = parseSupabaseScriptEnv(process.env);
  const client = new SupabaseRestClient(env);

  return createReferenceRepository({ client });
}

export function createLazyDefaultReferenceRepository() {
  let repository;

  function getRepository() {
    repository ??= createDefaultReferenceRepository();
    return repository;
  }

  return {
    getMetadata() {
      return getRepository().getMetadata();
    },
    listMuscles() {
      return getRepository().listMuscles();
    },
    listEquipment() {
      return getRepository().listEquipment();
    },
    listCategories() {
      return getRepository().listCategories();
    },
    listExerciseFlags() {
      return getRepository().listExerciseFlags();
    },
    listJointRegions() {
      return getRepository().listJointRegions();
    }
  };
}

export function createReferenceRepository({ client }) {
  return {
    async getMetadata() {
      const [muscles, equipment, categories, exerciseFlags, jointRegions] =
        await Promise.all([
          this.listMuscles(),
          this.listEquipment(),
          this.listCategories(),
          this.listExerciseFlags(),
          this.listJointRegions()
        ]);

      return {
        muscles,
        equipment,
        categories,
        exerciseFlags,
        jointRegions,
        enums: CATALOG_ENUM_VALUES
      };
    },

    async listMuscles() {
      const rows = await selectReferenceRows(client, {
        table: 'muscles',
        columns: 'id,slug,name,region,muscle_group,display_order,updated_at'
      });

      return rows.map(mapMuscle);
    },

    async listEquipment() {
      const rows = await selectReferenceRows(client, {
        table: 'equipment',
        columns: 'id,slug,name,equipment_group,display_order,updated_at'
      });

      return rows.map(mapEquipment);
    },

    async listCategories() {
      const rows = await selectReferenceRows(client, {
        table: 'categories',
        columns: 'id,slug,name,category,description,display_order,updated_at'
      });

      return rows.map(mapCategory);
    },

    async listExerciseFlags() {
      const rows = await selectReferenceRows(client, {
        table: 'exercise_flags',
        columns: 'id,slug,name,description,display_order,updated_at'
      });

      return rows.map(mapExerciseFlag);
    },

    async listJointRegions() {
      const rows = await selectReferenceRows(client, {
        table: 'joint_regions',
        columns: 'id,slug,name,region_group,display_order,updated_at'
      });

      return rows.map(mapJointRegion);
    }
  };
}

function selectReferenceRows(client, { table, columns }) {
  return client.select(table, {
    columns,
    filters: {
      order: 'display_order.asc'
    }
  });
}

function mapMuscle(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    region: row.region,
    muscleGroup: row.muscle_group,
    displayOrder: row.display_order,
    updatedAt: row.updated_at
  };
}

function mapEquipment(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    equipmentGroup: row.equipment_group,
    displayOrder: row.display_order,
    updatedAt: row.updated_at
  };
}

function mapCategory(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    displayOrder: row.display_order,
    updatedAt: row.updated_at
  };
}

function mapExerciseFlag(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    displayOrder: row.display_order,
    updatedAt: row.updated_at
  };
}

function mapJointRegion(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    regionGroup: row.region_group,
    displayOrder: row.display_order,
    updatedAt: row.updated_at
  };
}
