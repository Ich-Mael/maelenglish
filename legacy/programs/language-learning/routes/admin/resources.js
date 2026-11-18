const express = require('express');
const router = express.Router();
const TeachingResource = require('../../models/TeachingResource');
const { isAdmin } = require('../../../../shared/middlewares/auth');

// List all teaching resources
router.get('/', isAdmin, async (req, res) => {
  try {
    const resources = await TeachingResource.find()
      .populate('courseId')
      .populate('moduleId')
      .populate('chapterId')
      .populate('createdBy', 'name surname')
      .sort({ updatedAt: -1 });
    
    res.render('admin/resources/index', {
      resources,
      title: 'Teaching Resources'
    });
  } catch (error) {
    console.error('Error listing resources:', error);
    req.flash('error', 'An error occurred while loading resources');
    res.redirect('/admin');
  }
});

// Show create resource form
router.get('/new', isAdmin, async (req, res) => {
  try {
    const Course = require('../../models/course');
    const Module = require('../../models/module');
    
    const courses = await Course.find();
    const modules = await Module.find();
    
    res.render('admin/resources/new', {
      courses,
      modules,
      title: 'Create Teaching Resource'
    });
  } catch (error) {
    console.error('Error loading create form:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/admin/resources');
  }
});

// Create teaching resource
router.post('/', isAdmin, async (req, res) => {
  try {
    const resource = new TeachingResource({
      courseId: req.body.courseId,
      moduleId: req.body.moduleId,
      chapterId: req.body.chapterId || null,
      resourceType: req.body.resourceType || 'lesson_plan',
      title: req.body.title,
      content: {
        objectives: req.body.objectives || '',
        materials: req.body.materials || '',
        warmUp: req.body.warmUp || '',
        mainActivity: req.body.mainActivity || '',
        practice: req.body.practice || '',
        assessment: req.body.assessment || '',
        homework: req.body.homework || '',
        notes: req.body.notes || ''
      },
      createdBy: req.user._id,
      tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [],
      isPublished: req.body.isPublished === 'true' || req.body.isPublished === true,
      accessLevel: req.body.accessLevel || 'all_instructors'
    });
    
    await resource.save();
    
    // Update module metadata
    const Module = require('../../models/module');
    await Module.findByIdAndUpdate(req.body.moduleId, {
      hasInstructorResources: true,
      lastResourceUpdate: Date.now(),
      $inc: { resourcesCount: 1 }
    });
    
    req.flash('success', 'Teaching resource created successfully');
    res.redirect(`/admin/resources/${resource._id}`);
  } catch (error) {
    console.error('Error creating resource:', error);
    req.flash('error', 'An error occurred while creating resource');
    res.redirect('/admin/resources/new');
  }
});

// View resource
router.get('/:id', isAdmin, async (req, res) => {
  try {
    const resource = await TeachingResource.findById(req.params.id)
      .populate('courseId')
      .populate('moduleId')
      .populate('chapterId')
      .populate('createdBy', 'name surname')
      .populate('lastEditedBy', 'name surname');
    
    if (!resource) {
      req.flash('error', 'Resource not found');
      return res.redirect('/admin/resources');
    }
    
    res.render('admin/resources/view', {
      resource,
      title: resource.title
    });
  } catch (error) {
    console.error('Error viewing resource:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/admin/resources');
  }
});

// Show edit resource form
router.get('/:id/edit', isAdmin, async (req, res) => {
  try {
    const resource = await TeachingResource.findById(req.params.id)
      .populate('courseId')
      .populate('moduleId')
      .populate('chapterId');
    
    if (!resource) {
      req.flash('error', 'Resource not found');
      return res.redirect('/admin/resources');
    }
    
    const Course = require('../../models/course');
    const Module = require('../../models/module');
    
    const courses = await Course.find();
    const modules = await Module.find();
    
    res.render('admin/resources/edit', {
      resource,
      courses,
      modules,
      title: 'Edit Resource'
    });
  } catch (error) {
    console.error('Error loading edit form:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/admin/resources');
  }
});

// Update resource
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const resource = await TeachingResource.findById(req.params.id);
    
    if (!resource) {
      req.flash('error', 'Resource not found');
      return res.redirect('/admin/resources');
    }
    
    resource.title = req.body.title;
    resource.resourceType = req.body.resourceType;
    resource.content = {
      objectives: req.body.objectives || '',
      materials: req.body.materials || '',
      warmUp: req.body.warmUp || '',
      mainActivity: req.body.mainActivity || '',
      practice: req.body.practice || '',
      assessment: req.body.assessment || '',
      homework: req.body.homework || '',
      notes: req.body.notes || ''
    };
    resource.tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [];
    resource.isPublished = req.body.isPublished === 'true' || req.body.isPublished === true;
    resource.accessLevel = req.body.accessLevel || 'all_instructors';
    resource.lastEditedBy = req.user._id;
    resource.updatedAt = Date.now();
    
    await resource.save();
    
    req.flash('success', 'Resource updated successfully');
    res.redirect(`/admin/resources/${resource._id}`);
  } catch (error) {
    console.error('Error updating resource:', error);
    req.flash('error', 'An error occurred while updating resource');
    res.redirect(`/admin/resources/${req.params.id}/edit`);
  }
});

// Delete resource
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const resource = await TeachingResource.findById(req.params.id);
    
    if (resource) {
      // Update module metadata
      const Module = require('../../models/module');
      await Module.findByIdAndUpdate(resource.moduleId, {
        $inc: { resourcesCount: -1 }
      });
      
      await TeachingResource.findByIdAndDelete(req.params.id);
    }
    
    req.flash('success', 'Resource deleted successfully');
    res.redirect('/admin/resources');
  } catch (error) {
    console.error('Error deleting resource:', error);
    req.flash('error', 'An error occurred while deleting resource');
    res.redirect('/admin/resources');
  }
});

// Duplicate resource
router.post('/:id/duplicate', isAdmin, async (req, res) => {
  try {
    const original = await TeachingResource.findById(req.params.id);
    
    if (!original) {
      req.flash('error', 'Resource not found');
      return res.redirect('/admin/resources');
    }
    
    const duplicate = new TeachingResource({
      courseId: original.courseId,
      moduleId: original.moduleId,
      chapterId: original.chapterId,
      resourceType: original.resourceType,
      title: `${original.title} (Copy)`,
      content: original.content,
      createdBy: req.user._id,
      tags: original.tags,
      isPublished: false,
      accessLevel: original.accessLevel
    });
    
    await duplicate.save();
    
    req.flash('success', 'Resource duplicated successfully');
    res.redirect(`/admin/resources/${duplicate._id}/edit`);
  } catch (error) {
    console.error('Error duplicating resource:', error);
    req.flash('error', 'An error occurred while duplicating resource');
    res.redirect('/admin/resources');
  }
});

module.exports = router;
