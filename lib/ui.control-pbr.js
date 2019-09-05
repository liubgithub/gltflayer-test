function AddGuiControl(gui, options, targets) {
    targets.forEach(target => {
        target.setRotation(90, 0, 180);
    });
    //LitShader
    var LitShaderFolder = gui.addFolder('LitShader');
    var postLightingColorController = LitShaderFolder.addColor(options, 'postLightingColor');
    postLightingColorController.onChange(function (value) {
        targets.forEach(target => {
            if (target.getShader() === 'lit') {
                const material = target.getMaterial() || {};
                material.postLightingColor = [value[0] / 255, value[1] / 255, value[2] / 255];
                target.setMaterial(material);
            }
        });
    });
    //reflectance
    var reflectanceController = LitShaderFolder.add( options, "reflectance", 0, 1);
    reflectanceController.onChange(function(value){
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.reflectance = value;
            target.setMaterial(material);
        });
    });
    //clearCoat
    // var clearCoatFolderController = gui.addFolder('clearCoatFolder');
    var clearCoatController = LitShaderFolder.add(options, 'clearCoat', 0, 4, 0.1);
    clearCoatController.onChange(function(value){
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.clearCoat = value;
            target.setMaterial(material);
        });
    });
    //clearCoatRoughness
    var clearCoatRoughnessController = LitShaderFolder.add(options, 'clearCoatRoughness', 0, 1, 0.1);
    clearCoatRoughnessController.onChange(function(value){
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.clearCoatRoughness = value;
            target.setMaterial(material);
        });
    });
    //anisotropy
    var anisotropyController = LitShaderFolder.add(options, 'anisotropy', -1, 1, 0.1);
    anisotropyController.onChange(function(value){
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.anisotropy = value;
            target.setMaterial(material);
        });
    });
    // anisotropyDirection
    var anisotropyDirectionXController = LitShaderFolder.add(options, 'anisotropyDirectionX', -1, 1);
    anisotropyDirectionXController.onChange(function (value) {
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.anisotropyDirection = [value, options.anisotropyDirectionY, options.anisotropyDirectionZ];
            target.setMaterial(anisotropyDirection);
        });
    });

    var anisotropyDirectionYController = LitShaderFolder.add(options, 'anisotropyDirectionY', -1, 1);
    anisotropyDirectionYController.onChange(function (value) {
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.anisotropyDirection = [options.anisotropyDirectionX, value, options.anisotropyDirectionZ];
            target.setMaterial(anisotropyDirection);
        });
    });

    var anisotropyDirectionZController = LitShaderFolder.add(options, 'anisotropyDirectionZ', -1, 1);
    anisotropyDirectionZController.onChange(function (value) {
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.anisotropyDirection = [options.anisotropyDirectionX, options.anisotropyDirectionY, value];
            target.setMaterial(anisotropyDirection);
        });
    });
    //SubSurfaceShader
    var SubSurfaceShaderFolder = gui.addFolder('SubSurfaceShader');
    var postLightingColorController = SubSurfaceShaderFolder.addColor(options, 'postLightingColor');
    postLightingColorController.onChange(function (value) {
        targets.forEach(target => {
            if (target.getShader() === 'subsurface') {
                const material = target.getMaterial() || {};
                material.postLightingColor = [value[0] / 255, value[1] / 255, value[2] / 255];
                target.setMaterial(material);
            }
        });
    });

    var thicknessController = SubSurfaceShaderFolder.add( options, "thickness", 0, 1);
    thicknessController.onChange(function(value){
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.thickness = value;
            target.setMaterial(material);
        });
    });

    var subsurfaceColorController = SubSurfaceShaderFolder.addColor(options, 'subsurfaceColor');
    subsurfaceColorController.onChange(function (value) {
        targets.forEach(target => {
            if (target.getShader() === 'subsurface') {
                const material = target.getMaterial() || {};
                material.subsurfaceColor = [value[0] / 255, value[1] / 255, value[2] / 255];
                target.setMaterial(material);
            }
        })
    });

    var subsurfacePowerController = SubSurfaceShaderFolder.add( options, "subsurfacePower", 0, 100);
    subsurfacePowerController.onChange(function(value){
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.subsurfacePower = value;
            target.setMaterial(material);
        });
    }); 
    //ClothShader
    var ClothShaderFolder = gui.addFolder('ClothShader');
    var subsurfaceColorController = ClothShaderFolder.addColor(options, 'subsurfaceColor');
    subsurfaceColorController.onChange(function (value) {
        targets.forEach(target => {
            if (target.getShader() === 'cloth') {
                const material = target.getMaterial() || {};
                material.subsurfaceColor = [value[0] / 255, value[1] / 255, value[2] / 255];
                target.setMaterial(material);
            }
        });
    });
    var sheenColorXController = ClothShaderFolder.add(options, 'sheenColorX', -1, 1);
    sheenColorXController.onChange(function (value) {
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.sheenColor = [value, options.sheenColorY, options.sheenColorZ];
            target.setMaterial(material);
        });
    });

    var sheenColorYController = ClothShaderFolder.add(options, 'sheenColorY', -1, 1);
    sheenColorYController.onChange(function (value) {
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.sheenColor = [options.sheenColorX, value, options.sheenColorZ];
            target.setMaterial(material);
        });
    });

    var sheenColorZController = ClothShaderFolder.add(options, 'sheenColorZ', -1, 1);
    sheenColorZController.onChange(function (value) {
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.sheenColor = [options.sheenColorX, options.sheenColorY, value];
            target.setMaterial(material);
        });
    });

    //统一都有
    var baseColorFactorController = gui.addColor(options, 'baseColorFactor');
    baseColorFactorController.onChange(function (value) {
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.baseColorFactor = [value[0] / 255, value[1] / 255, value[2] / 255, 1.0];
            target.setMaterial(material);
        });
    });

    var emissiveFactorController = gui.addColor(options, 'emissiveFactor');
    emissiveFactorController.onChange(function (value) {
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.emissiveFactor = [value[0] / 255, value[1] / 255, value[2] / 255, 1.0];
            target.setMaterial(material);
        });
    });

    var metallicFactorController = gui.add(options, 'metallicFactor', 0, 1);
    metallicFactorController.onChange(function(value){
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.metallicFactor = value;
            target.setMaterial(material);
        });
    });
    var roughnessFactorController = gui.add( options, "roughnessFactor", 0, 1);
    roughnessFactorController.onChange(function(value){
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.roughnessFactor = value;
            target.setMaterial(material);
        });
    });
    
    var occlusionController = gui.add( options, "occlusion", 0, 1);
    occlusionController.onChange(function(value){
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.occlusion = value;
            target.setMaterial(material);
        });
    });

    var occlusionStrengthController = gui.add( options, "occlusionStrength", 0, 1);
    occlusionStrengthController.onChange(function(value){
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.occlusionStrength = value;
            target.setMaterial(material);
        });
    });

    var normalStrenthController = gui.add( options, "normalStrenth", 0, 1);
    normalStrenthController.onChange(function(value){
        targets.forEach(target => {
            const material = target.getMaterial() || {};
            material.normalStrenth = value;
            target.setMaterial(material);
        });
    });
    //lightColorIntensity
    var lightColorIntensityController = gui.addFolder('lightColorIntensity');
    var lightColorIntensityControllerX = lightColorIntensityController.add(options, 'lightColorIntensityX', 0, 1);
    lightColorIntensityControllerX.onChange(function(value){
        options['lightColorIntensityX'] = value;
        targets.forEach(target => {
            target.setUniform('lightColorIntensity', [options['lightColorIntensityX'], options['lightColorIntensityY'], options['lightColorIntensityZ'], options['lightColorIntensityW']]);
        });
    });
    var lightColorIntensityControllerY = lightColorIntensityController.add(options, 'lightColorIntensityY', 0, 1);
    lightColorIntensityControllerY.onChange(function(value){
        options['lightColorIntensityY'] = value;
        targets.forEach(target => {
            target.setUniform('lightColorIntensity', [options['lightColorIntensityX'], options['lightColorIntensityY'], options['lightColorIntensityZ'], options['lightColorIntensityW']]);
        });
    });
    var lightColorIntensityControllerZ = lightColorIntensityController.add(options, 'lightColorIntensityZ', 0, 1);
    lightColorIntensityControllerZ.onChange(function(value){
        options['lightColorIntensityZ'] = value;
        targets.forEach(target => {
            target.setUniform('lightColorIntensity', [options['lightColorIntensityX'], options['lightColorIntensityY'], options['lightColorIntensityZ'], options['lightColorIntensityW']]);
        });
    });
    var lightColorIntensityControllerW = lightColorIntensityController.add(options, 'lightColorIntensityW', 0, 50000);
    lightColorIntensityControllerW.onChange(function(value){
        options['lightColorIntensityW'] = value;
        targets.forEach(target => {
            target.setUniform('lightColorIntensity', [options['lightColorIntensityX'], options['lightColorIntensityY'], options['lightColorIntensityZ'], options['lightColorIntensityW']]);
        });
    });
    //sun
    var sunController = gui.addFolder('sun');
    var sunControllerX = sunController.add(options, 'sunX');
    sunControllerX.onChange(function(value){
        options['sunX'] = value;
        targets.forEach(target => {
            target.setUniform('sun', [options['sunX'], options['sunY'], options['sunZ'], options['sunW']]);
        });
    });
    var sunControllerY = sunController.add(options, 'sunY');
    sunControllerY.onChange(function(value){
        options['sunY'] = value;
        targets.forEach(target => {
            target.setUniform('sun', [options['sunX'], options['sunY'], options['sunZ'], options['sunW']]);
        });
    });
    var sunControllerZ = sunController.add(options, 'sunZ');
    sunControllerZ.onChange(function(value){
        options['sunZ'] = value;
        targets.forEach(target => {
            target.setUniform('sun', [options['sunX'], options['sunY'], options['sunZ'], options['sunW']]);
        });
    });
    var sunControllerW = sunController.add(options, 'sunW', -1, 1);
    sunControllerW.onChange(function(value){
        options['sunW'] = value;
        targets.forEach(target => {
            target.setUniform('sun', [options['sunX'], options['sunY'], options['sunZ'], options['sunW']]);
        });
    });
    //lightDirection
    var lightDirectionController = gui.addFolder('lightDirection');
    var lightDirectionControllerX = lightDirectionController.add(options, 'lightDirectionX',-1, 1);
    lightDirectionControllerX.onChange(function(value){
        options['lightDirectionX'] = value;
        targets.forEach(target => {
            target.setUniform('lightDirection', [options['lightDirectionX'], options['lightDirectionY'], options['lightDirectionZ']]);
        });
    });
    var lightDirectionControllerY = lightDirectionController.add(options, 'lightDirectionY', -1, 1);
    lightDirectionControllerY.onChange(function(value){
        options['lightDirectionY'] = value;
        targets.forEach(target => {
            target.setUniform('lightDirection', [options['lightDirectionX'], options['lightDirectionY'], options['lightDirectionZ']]);
        });
    });
    var lightDirectionControllerZ = lightDirectionController.add(options, 'lightDirectionZ', -1, 1);
    lightDirectionControllerZ.onChange(function(value){
        options['lightDirectionZ']= value;
        targets.forEach(target => {
            target.setUniform('lightDirection', [options['lightDirectionX'], options['lightDirectionY'], options['lightDirectionZ']]);
        });
    });
    //iblLuminance
    var iblLuminanceController = gui.add(options, 'iblLuminance', 0, 50000);
    iblLuminanceController.onChange(function(value){
        options['iblLuminance'] = value;
        targets.forEach(target => {
            target.setUniform('iblLuminance', options['iblLuminance']);
        });
    });
    //exposure
    var exposureController = gui.addFolder('exposure');
    var apertureController = exposureController.add(options, 'aperture', [1.0, 1.2, 1.4, 1.8, 2, 2.5, 2.8, 3.2, 4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 18, 22, 27, 32]);
    apertureController.onChange(function(value){
        options['aperture'] = value;
        updateEV100(targets, options['aperture'], options['speed'], options['iso']);
    });
    var speedController = exposureController.add(options, 'speed', ['1/4000', '1/2000', '1/1000', '1/500', '1/250', '1/125', '1/60', '1/30', '1/15', '1/8', '1/4', '1/2', '1', '2', '4']);
    speedController.onChange(function(value){
        var values = value.split('/');
        options['speed'] = Number(values[0]) / Number(values[1]);
        updateEV100(targets, options['aperture'], options['speed'], options['iso']);
    });
    var isoController = exposureController.add(options, 'iso', [ 100.0, 125.0, 160.0, 200.0, 250.0, 320.0, 400.0, 500.0, 640.0, 800.0, 1000.0, 1250.0, 1600.0, 2000.0, 2500.0, 3200.0, 4000.0, 5000.0, 6400.0]);
    isoController.onChange(function(value){
        options['iso'] = value;
        updateEV100(targets, options['aperture'], options['speed'], options['iso']);
    });
}

function updateEV100(targets, aperture, speed, iso) {
    var ev100 = computeEV100(aperture, speed, iso);
    var exposure = EV100toExposure(ev100);
    targets.forEach(target => {
        target.setUniform('ev100', ev100);
        target.setUniform('exposure', exposure);
    });
}

function EV100toExposure(EV100) {
    return 1.0 / (1.2 * Math.pow(2.0, EV100));
}

function computeEV100(aperture, shutterSpeed, iso) {
    // log2((N^2*S)/(t*100))
    if (shutterSpeed.indexOf && shutterSpeed.indexOf('/') > -1) {
        shutterSpeed = shutterSpeed.split('/');
        shutterSpeed = shutterSpeed[0] / shutterSpeed[1];
    }
    return Math.log2(((aperture * aperture) * 100.0) / (shutterSpeed * iso));
}

function EV100toExposure(EV100) {
    return 1.0 / (1.2 * Math.pow(2.0, EV100));
}
