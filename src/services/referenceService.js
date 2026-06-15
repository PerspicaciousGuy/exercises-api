export function createReferenceService({ referenceRepository }) {
  return {
    getMetadata() {
      return referenceRepository.getMetadata();
    },
    listMuscles() {
      return referenceRepository.listMuscles();
    },
    listEquipment() {
      return referenceRepository.listEquipment();
    },
    listCategories() {
      return referenceRepository.listCategories();
    },
    listExerciseFlags() {
      return referenceRepository.listExerciseFlags();
    },
    listJointRegions() {
      return referenceRepository.listJointRegions();
    }
  };
}
