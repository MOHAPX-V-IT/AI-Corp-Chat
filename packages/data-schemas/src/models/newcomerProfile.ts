import newcomerProfileSchema from '~/schema/newcomerProfile';
export function createNewcomerProfileModel(mongoose: typeof import('mongoose')) {
 return mongoose.models.NewcomerProfile || mongoose.model('NewcomerProfile', newcomerProfileSchema);
}
