const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/user');

// register a user form
router.get('/register', (req, res)=>{
    res.render('user/register');
});

// register user to DB
router.post('/register', async (req, res)=>{
    try{
        const {name, surname, email, username, password} = req.body;
        const user = new User({name, surname, email, username});
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err=>{
            if(err){
                res.send('Something Went Wrong');
            }else{
                req.flash('success', 'Votre compte a été créé avec success');
                res.redirect('/');
            }
        });
            }catch(e){
        req.flash('error', e.message);
        res.redirect('/register');
    }
   });

// login user form
router.get('/login', (req, res)=>{
    res.render('user/login');
});

router.post('/login', passport.authenticate('local', {failureFlash: true, failureRedirect:'/login'}), (req, res)=>{
    req.flash('success', 'Welcome back ' + req.user.username.toUpperCase());
    const redirectUrl = req.session.returnTo || '/';
    delete req.session.returnTo ;
    res.redirect(redirectUrl);
});

// logout
router.get('/logout', (req, res)=>{
    req.logout();
    req.flash('success', `Goodbye ! See you nextime!!`);
    res.redirect('/');
});

module.exports = router;



