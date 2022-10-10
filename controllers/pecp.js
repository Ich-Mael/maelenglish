const User = require("../models/user");

const {
    pecpStudent,
    pecpCoach,
    pecpConvFeedback,
    pecpStudentProgressTrack,
} = require("../models/pecp");

// new pecp student
module.exports.addNewPecpStudent = async (req, res) => {
    const user = await User.findOne({
        username: req.body.pecpUser
    });


    //Checking if user alreasdy has pecp status
    const checkPecpStudent = await pecpStudent.findOne({
        pecpStudentBasicInfo: user._id
    });

    if (checkPecpStudent) {
        req.flash('error', `${user.surname} ${user.name} a déjà enrollé pour le PECP`);
        res.redirect("back");
    } else {
        // create a new pecp account
        const newPecpStudent = new pecpStudent({
            pecpStudentBasicInfo: user._id,
            level: req.body.level,
            learningGoal: req.body.learningGoal
        })

        await newPecpStudent.save();

        // Adding pecp status to user

        user.isPecpStudent = true
        user.pecpStudent_id = `${newPecpStudent._id}`

        await user.save();

        req.flash('success', `${user.surname} ${user.name} a été enrollé avec succès au PECP`);
        res.redirect("back");
    }
}

// new coach 
module.exports.addNewPecpCoach = async (req, res) => {
    const user = await User.findOne({
        username: req.body.pecpUser
    });


    //Checking if user alreasdy has pecp status
    const checkPecpCoach = await pecpCoach.findOne({
        pecpCoachBasicInfo: user._id
    });

    if (checkPecpCoach) {
        req.flash('error', `${user.surname} ${user.name} a déjà le statut de PECP Coah`);
        res.redirect("back");
    } else {
        // create a new pecp account
        const newPecpCoach = new pecpCoach({
            pecpCoahBasicInfo: user._id,
            level: req.body.level
        })

        await newPecpCoach.save();


        // Adding pecp status to user

        user.isPecpCoach = true
        user.pecpCoach_id = `${newPecpCoach._id}`

        await user.save();

        req.flash('success', `Status PECP Coach activé pour ${user.surname} ${user.name}`);
        res.redirect("back");
    }
}

//Pecp student dashboard
module.exports.pecpStudentDashboard = async (req, res) => {
    const student = await pecpStudent.findById(req.params.pecpStudent_id).populate("pecpStudentProgressTrack");
    const user = await User.findById(req.params.user_id).populate("coursesTaken")

    res.render("programs/pecp/myPecpSpace", {
        student,
        user
    })
}

//Pecp Coach dashboard
module.exports.pecpStudentDashboard = async (req, res) => {
    const coach = await pecpCoach.findById(req.params.pecpCoach_id).populate("Students");
    const user = await User.findById(req.params.user_id)

    res.render("programs/pecp/myPecpCoachingSpace", {
        coach,
        user
    })
}

// Assign a coach to a student
module.exports.pecpCoachAssignment = async (req, res) => {
    const coach = await User.findOne({
        username: req.body.coach
    });

    const student = await User.findOne({
        username: req.body.student
    });

    const pecp_Coach = await pecpCoach.findById(coach.pecpCoach_id);

    const pecp_Student = await pecpStudent.findById(student.pecpStudent_id);

    pecp_Coach.students.push(pecp_Student._id);

    pecp_Student.assignedCoach.push(pecp_Coach._id);

    await pecp_Coach.save();
    await pecp_Student.save();

    res.redirect("back");
}