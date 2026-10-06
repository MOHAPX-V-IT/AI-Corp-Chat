import iprEntrySchema from '~/schema/iprEntry';
export function createIprEntryModel(mongoose: typeof import('mongoose')) {
 return mongoose.models.IprEntry || mongoose.model('IprEntry', iprEntrySchema);
}
