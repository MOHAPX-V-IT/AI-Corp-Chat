import { Schema } from 'mongoose';
const newcomerProfileSchema = new Schema({
 profile_id:{type:String,index:true,unique:true,required:true},
 name:{type:String,required:true,index:true},
 rm:{type:String,required:true,index:true},
 department:{type:String,enum:['MP','RM','RGR','ROP','HR','PRODUCTION'],required:true,index:true},
 startDate:{type:Date,required:true},resumeText:{type:String},bigFiveResults:{type:String},managerComments:{type:String},
 status:{type:String,enum:['candidate','onboarding','probation','completed'],default:'candidate',index:true},
 createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
},{timestamps:true});
export default newcomerProfileSchema;
