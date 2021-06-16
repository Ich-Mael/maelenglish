module.exports.checkCourseOwnership = courseTitle =>(req, res, next)=>{
    if(!req.user.courseTaken.some(el => el.title === courseTitle)!==-1){
        res.render('noAccess');
    }else{
        next();
    }
};
