module.exports.checkCourseOwnership = course =>(req, res, next)=>{
    if(!req.user.ownedCourses.some(arr => arr.indexOf(course)!==-1)){
        res.render('noAccess');
    } else{
        next();
    }
};
