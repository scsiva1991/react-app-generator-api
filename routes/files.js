var express = require('express');
var router = express.Router();
const fs = require('fs-extra');
const async = require('async');
const _ = require('lodash');
const zipFolder = require('zip-folder');
const uuid = require('uuid');

router.post('/', function(req, res, next) {
    console.log( req.body );
    const appData = req.body.appData;
    const folderName = uuid();
    async.waterfall([
        async.apply(copyCodebase, 'react-base', appData),
        generateFiles
    ], (err, result) => {
        // fs.readFile('react-base.zip', (err, file) => {
        //     if (err) throw err;
        //     console.log('**', file);
        //     res.setHeader('Content-Type', 'application/x-zip'); 
        //     res.setHeader('Content-Disposition', 'attachment; filename=react-base.zip');
        //     res.write(file, 'binary');
        //     res.end();
        // });
        res.download('react-base.zip');
        //res.send('success');
    });   
});

router.get('/download', function(req, res) {
    res.download('react-base.zip');
  });

const container = `
import React, { Component } from 'react';
#{importComponents}

class App extends Component {
  render() {
    return (
      <div className="App">
      #{childrens}
      </div>
    );
  }
}

export default App;
`

const format = (template, params) => {
    let tpl = template.replace(/\#{(?!this\.)/g, "${this.");
    let tpl_func = new Function(`return \`${tpl}\``);
    console.log('tpl', tpl);
    console.log('tpl_func', tpl_func);
    return tpl_func.call(params);
};

const template = `
import React, { Component } from 'react';
#{childImports}

export default class #{componentName} extends Component {
    render() {
        return(
	    <div>
		    #{childrens}
	    </div>
	)
    }
}`;

const importMap = {
    'Navbar': `import { Collapse, 
        Navbar,
        NavbarToggler,
        NavbarBrand,
        Nav,
        NavItem,
        NavLink
    } from 'reactstrap';`,
    'Button': `import { Button } from 'reactstrap';`,
    'Grid': `import { Container, Row, Col } from 'reactstrap';`,
    'Card': `import { Card, CardImg, CardText, CardBody,
        CardTitle, CardSubtitle, Button } from 'reactstrap';`,
    'Jumbotron': `import { Jumbotron } from 'reactstrap';`
}



const Navbar = `
                <Navbar color="#{color}" dark="#{dark}"  expand="md">
                    <NavbarBrand href="/">Navbar</NavbarBrand>
                    <NavbarToggler/>
                    <Collapse navbar>
                        <Nav className="ml-auto" navbar>
                        <NavItem active>
                            <NavLink href="#">Menu 1</NavLink>
                        </NavItem>
                        <NavItem>
                            <NavLink href="#">Menu 2</NavLink>
                        </NavItem>
                        <NavItem>
                            <NavLink href="#">Menu 3</NavLink>
                        </NavItem>
                        </Nav>
                    </Collapse>
                </Navbar>`;

const Card = `
                <Card>
                    <CardImg top width="100%" src="https://placeholdit.imgix.net/~text?txtsize=33&txt=318%C3%97180&w=318&h=180" alt="Card image cap" />
                    <CardBody>
                    <CardTitle>Card title</CardTitle>
                    <CardSubtitle>Card subtitle</CardSubtitle>
                    <CardText>Some quick example text to build on the card title and make up the bulk of the card's content.</CardText>
                    <Button>Button</Button>
                    </CardBody>
                </Card>`;

const Grid = `
        <Container className="mg-t-10">
            <Row>
                #{nestedChildrens}
            </Row>
        </Container>`;

const Jumbotron = `
        <Jumbotron>
            <h1 className="display-3">Hello, world!</h1>
            <p className="lead">This is a simple hero unit, a simple Jumbotron-style component for calling extra attention to featured content or information.</p>
            <hr className="my-2" />
            <p>It uses utility classes for typography and spacing to space content out within the larger container.</p>
            <p className="lead">
            </p>
        </Jumbotron>
`;

const componentMap = {
    'Navbar': Navbar,
    'Card': Card,
    'Grid': Grid,
    'Jumbotron': Jumbotron
};

function copyCodebase( appName, appData, cb){
    fs.copy('react-code', appName).then(
        () => {
            console.log('*** copied ***');
            cb(null, appName, appData);
        }
    ).catch(err => cb(err));
}

function generateFiles( appName, appData, cb) {
    let componentNames = [];
    async.eachSeries(appData, (app, asynCb) => {
        const file = `${appName}/src/components/${app.componentName}.js`;
        componentNames.push( app.componentName );
        async.waterfall([
            async.apply(addImports, app, file),
            writeToFile,
            async.apply(zipTheFile, appName)
        ], (err) => {
            asynCb(err);
        });
    }, (err) => {
        let imports = [], childrens = [];
        for( let comp of componentNames ) {
            imports.push( `import ${comp} from './components/${comp}';` );
            childrens.push( `<${comp} />`);
        }
        let content = format(container, { 
            'childrens': format(childrens.join('\n'), {}),
            'importComponents': _.uniq(imports).join('\n')
        });
        writeToFile(`${appName}/src/App.js`, content, (err) => {
            cb(err);
        });        
    });
}

function zipTheFile(appName, zipCb) {
    zipFolder(appName, `${appName}.zip`, function(err) {
        if(err) {
            console.log('oh no!', err);
            zipCb(err);
        } else {
            console.log('EXCELLENT');
            zipCb(null);
        }
    });
}

function addImports(app, file, importCb) {
    let childImports = [], nestedImports = [], childComps = [], props = null,
    nestedComps = [];
    let content = null;
    async.eachSeries(app.childrens, (child, asynCb) => {
        childImports.push( importMap[child.component]);
        childComps.push( componentMap[child.component] )
        
        nestedImports = child.props.childrens.map(child => {
            return importMap[child.component];
        });

        nestedComps = child.props.childrens.map(child => {
            return componentMap[child.component];
        });
        props = child.props;
        props.nestedChildrens = nestedComps;
        console.log(nestedImports);
        setTimeout(function(){ asynCb(null); }, 3000);
    }, (err) => {
        content = format(template, {
            'componentName': app.componentName,
            'childrens': format(childComps.join('\n'), props),
            'childImports': _.uniq(childImports.concat(nestedImports)).join('\n'),
            props
        });
        return importCb(null, file, content);
    })
    
}

function writeToFile(file, content, writeCb) {
    fs.writeFile(file, content, function (err) {
        if (err) throw err;
        writeCb(err);
        console.log('Saved!');
    });
}

module.exports = router;
